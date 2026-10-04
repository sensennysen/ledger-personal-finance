-- LED-185 (OD-10 a): a transfer between two currencies stores the amount the destination receives.
-- A transfer carried one amount. The balance trigger credited the destination with
-- amount * exchange_rate, and no screen ever set exchange_rate (it is 1 on every row, see
-- rules/foreign-currency-rate-of-one-is-not-a-rate.md), so 100 USD sent to a EUR account
-- arrived as 100 EUR.
--
-- destination_amount is that second figure, in the destination account's currency. It is null
-- for a transfer within one currency and on every other row, and the trigger then credits what
-- it always did, coalesce(destination_amount, amount * exchange_rate), so no existing balance
-- moves and nothing is backfilled. The client mirror is src/lib/transferCredit.ts.

alter table public.transactions
  add column if not exists destination_amount numeric(18, 2);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_destination_amount_check'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_destination_amount_check
      check (destination_amount is null or destination_amount > 0);
  end if;
end;
$$;

-- update_account_balance(), as in 20260810120000_add_loan_tracker.sql, with the transfer's
-- destination credited (and reversed) by coalesce(destination_amount, amount * exchange_rate).
create or replace function public.update_account_balance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    if old.type = 'income' then
      update accounts set balance = balance - old.amount where id = old.account_id;
    elsif old.type = 'expense' then
      update accounts set balance = balance + old.amount where id = old.account_id;
      if old.to_account_id is not null then
        update accounts set balance = balance - old.amount where id = old.to_account_id and type = 'loan';
      end if;
    elsif old.type = 'transfer' then
      update accounts set balance = balance + old.amount + coalesce(old.transfer_fee, 0) where id = old.account_id;
      if old.to_account_id is not null then
        update accounts set balance = balance - coalesce(old.destination_amount, old.amount * old.exchange_rate)
         where id = old.to_account_id;
      end if;
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    if new.type = 'income' then
      update accounts set balance = balance + new.amount where id = new.account_id;
    elsif new.type = 'expense' then
      update accounts set balance = balance - new.amount where id = new.account_id;
      if new.to_account_id is not null then
        update accounts set balance = balance + new.amount where id = new.to_account_id and type = 'loan';
      end if;
    elsif new.type = 'transfer' then
      update accounts set balance = balance - new.amount - coalesce(new.transfer_fee, 0) where id = new.account_id;
      if new.to_account_id is not null then
        update accounts set balance = balance + coalesce(new.destination_amount, new.amount * new.exchange_rate)
         where id = new.to_account_id;
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- An edit to the destination amount alone must move the destination balance.
drop trigger if exists trg_update_balance_update on public.transactions;
create trigger trg_update_balance_update
  after update of amount, type, account_id, to_account_id, exchange_rate, transfer_fee, destination_amount
  on public.transactions
  for each row execute procedure public.update_account_balance();

-- sync_card_payment_on_transfer_update(), as in 20261003100000_card_payment_from_an_edit.sql, with
-- the card credited by the same amount the balance trigger uses.
create or replace function public.sync_card_payment_on_transfer_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  pay public.credit_card_payments%rowtype;
  credited numeric(18,2);
begin
  select * into pay from public.credit_card_payments where transaction_id = old.id for update;
  if found then
    perform public.card_statement_shift(pay.account_id, -pay.amount);

    if new.type = 'transfer' and new.to_account_id = pay.account_id then
      credited := coalesce(new.destination_amount, round(new.amount * coalesce(new.exchange_rate, 1), 2));
      update public.credit_card_payments
         set amount = credited, payment_date = new.date
       where id = pay.id;
      perform public.card_statement_shift(pay.account_id, credited);
      perform public.card_statement_refresh_last(pay.account_id, pay.amount, pay.payment_date);
      return new;
    end if;

    -- No longer a payment to this card, so it leaves the card's history.
    delete from public.credit_card_payments where id = pay.id;
    perform public.card_statement_refresh_last(pay.account_id, pay.amount, pay.payment_date);
  elsif old.type = 'transfer' and old.to_account_id is not distinct from new.to_account_id then
    -- Already a transfer into this destination with no linked payment: left as it was.
    return new;
  end if;

  -- The edit made it a payment to a card it was not paying before.
  if new.type = 'transfer'
     and exists (select 1 from public.accounts where id = new.to_account_id and type = 'credit_card') then
    credited := coalesce(new.destination_amount, round(new.amount * coalesce(new.exchange_rate, 1), 2));
    insert into public.credit_card_payments (user_id, account_id, amount, payment_date, transaction_id)
    values (new.user_id, new.to_account_id, credited, new.date, new.id);
    perform public.card_statement_shift(new.to_account_id, credited);
    perform public.card_statement_refresh_last(new.to_account_id, null, null);
  end if;
  return new;
end;
$$;

revoke all on function public.sync_card_payment_on_transfer_update() from public;

drop trigger if exists trg_sync_card_payment_update on public.transactions;
create trigger trg_sync_card_payment_update
  after update of amount, exchange_rate, destination_amount, date, type, to_account_id on public.transactions
  for each row execute function public.sync_card_payment_on_transfer_update();

-- post_recurring_transaction(), as in 20261003110000_recurring_posts_once.sql, copying the
-- destination amount so a recurring transfer between currencies posts what the user entered.
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
    exchange_rate, destination_amount, description, notes, date, transfer_fee, is_recurring,
    recurrence_interval, recurrence_end_date, receipt_url, tags, goal_id
  ) values (
    src.user_id, src.account_id, src.to_account_id, src.category_id, src.subcategory_id, src.type,
    src.amount, src.currency, src.exchange_rate, src.destination_amount, src.description, src.notes,
    p_date, src.transfer_fee, true, src.recurrence_interval, src.recurrence_end_date, null,
    coalesce(src.tags, '{}'), src.goal_id
  )
  returning id into posted_id;

  return posted_id;
end;
$$;

revoke all on function public.post_recurring_transaction(uuid, date) from public;
grant execute on function public.post_recurring_transaction(uuid, date) to authenticated;
