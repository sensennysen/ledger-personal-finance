-- LED-232: a recurring row posts its next occurrence once, whatever browser or device runs the generator.
-- generateDueRecurring remembered what it had posted only in localStorage, so a second browser, a
-- private window or cleared site data posted every due row again. Each copy is recurring itself, so
-- the copies posted their own next dates too, and an older occurrence re-posted a month that already
-- had its row.
--
-- recurrence_next_posted is the record: true once the row's next occurrence has been posted. It is
-- never cleared, so deleting the posted row does not bring it back. post_recurring_transaction locks
-- the source row, checks the flag, sets it and inserts the copy in one statement, so two browsers
-- racing each other get one row.
--
-- SECURITY INVOKER: row level security applies, and the owner is taken from the locked source row.
-- The client passes the date: JavaScript's month step (Jan 31 + 1 month = Mar 3) differs from
-- Postgres's (Feb 28), and the generator keeps the dates it has always posted.

alter table public.transactions
  add column if not exists recurrence_next_posted boolean not null default false;

create index if not exists transactions_recurring_due_idx
  on public.transactions (user_id)
  where is_recurring and not recurrence_next_posted;

-- Existing rows: a recurring row has already posted when its series shows it. A series is the rows with
-- the same account, destination, type and description. The row counts as posted when:
--   * any row of the series is on its next date (a posted copy, recurring or not), or
--   * a later recurring row of the series, same interval, is on or after that date (the copy was
--     deleted, or posted on another day), or
--   * it is a later duplicate (same date, amount, category and interval) of an earlier recurring row.
-- Two series that share a description stay apart (payroll on the 15th and on the last day): each
-- one's rows fall before the other's next date. Duplicates are left in place for the user; marking
-- them only stops them posting copies of their own.
-- next_date mirrors addRecurringInterval in src/lib/recurringTransactions.ts, which lets a short month
-- overflow (Jan 31 + 1 month = Mar 3), so a copy it posted is found on the date it was given.
-- Only set_updated_at fires for this column (every other update trigger names its columns); it is
-- paused so the backfill does not look like an edit to a queued offline change.
alter table public.transactions disable trigger set_transactions_updated_at;

with legacy as (
  select
    t.*,
    case t.recurrence_interval
      when 'daily'     then t.date + 1
      when 'weekly'    then t.date + 7
      when 'biweekly'  then t.date + 14
      when 'monthly'   then (date_trunc('month', t.date) + interval '1 month')::date + (extract(day from t.date)::int - 1)
      when 'quarterly' then (date_trunc('month', t.date) + interval '3 months')::date + (extract(day from t.date)::int - 1)
      when 'yearly'    then (date_trunc('month', t.date) + interval '1 year')::date + (extract(day from t.date)::int - 1)
    end as next_date
  from public.transactions t
  where t.is_recurring
    and t.recurrence_interval is not null
    and not t.recurrence_next_posted
)
update public.transactions t
   set recurrence_next_posted = true
  from legacy l
 where t.id = l.id
   and exists (
     select 1
       from public.transactions s
      where s.id <> l.id
        and s.user_id = l.user_id
        and s.account_id = l.account_id
        and s.to_account_id is not distinct from l.to_account_id
        and s.type = l.type
        and s.description = l.description
        and (
          s.date = l.next_date
          or (s.is_recurring and s.recurrence_interval = l.recurrence_interval and s.date >= l.next_date)
          or (
            s.is_recurring
            and s.recurrence_interval = l.recurrence_interval
            and s.date = l.date
            and s.amount = l.amount
            and s.category_id is not distinct from l.category_id
            and (s.created_at, s.id) < (l.created_at, l.id)
          )
        )
   );

alter table public.transactions enable trigger set_transactions_updated_at;

create or replace function public.post_recurring_transaction(p_source uuid, p_date date)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  src public.transactions;
  posted_id uuid;
begin
  select * into src from public.transactions where id = p_source for update;
  if not found then
    raise exception 'Recurring transaction not found';
  end if;

  -- Not recurring any more, already posted (by this or another device), or past its end date.
  if not src.is_recurring or src.recurrence_interval is null or src.recurrence_next_posted then
    return null;
  end if;
  if src.recurrence_end_date is not null and p_date > src.recurrence_end_date then
    return null;
  end if;
  if p_date is null or p_date <= src.date then
    raise exception 'The next occurrence must be dated after %', src.date;
  end if;

  update public.transactions set recurrence_next_posted = true where id = src.id;

  insert into public.transactions (
    user_id, account_id, to_account_id, category_id, subcategory_id, type, amount, currency,
    exchange_rate, description, notes, date, transfer_fee, is_recurring, recurrence_interval,
    recurrence_end_date, receipt_url, tags, goal_id
  ) values (
    src.user_id, src.account_id, src.to_account_id, src.category_id, src.subcategory_id, src.type,
    src.amount, src.currency, src.exchange_rate, src.description, src.notes, p_date, src.transfer_fee,
    true, src.recurrence_interval, src.recurrence_end_date, null, coalesce(src.tags, '{}'), src.goal_id
  )
  returning id into posted_id;

  return posted_id;
end;
$$;

revoke all on function public.post_recurring_transaction(uuid, date) from public;
grant execute on function public.post_recurring_transaction(uuid, date) to authenticated;
