-- LED-277: splitting the row that carries a recurring schedule keeps the series running.
-- split_transaction inserted every line with is_recurring false and no interval, then deleted the
-- source, so splitting the latest row of a series ended it silently (owner's pick, 2026-10-06: A).
--
-- The row carrying the schedule is the one the generator still reads: is_recurring and not
-- recurrence_next_posted. When the original is that row, line 1 inherits its interval, end date and
-- the unposted flag, so the next due date posts once, from line 1. Its amount, description and
-- category become the series; the generator keys a series on the row id (LED-260), not the
-- description. Every other line, and every split of an older row, is inserted as before.
--
-- Unchanged otherwise: SECURITY INVOKER, so row level security applies; transfers and payments to
-- another account are refused; lines must add up to the original amount.
--
-- lines: [{ "description": text, "category_id": uuid | null, "amount": number }, ...]
-- Returns the new transaction ids, in line order.
create or replace function public.split_transaction(original_id uuid, lines jsonb)
returns uuid[]
language plpgsql
security invoker
set search_path = public
as $$
declare
  original public.transactions%rowtype;
  line record;
  line_amount numeric(18,2);
  line_description text;
  line_category uuid;
  line_total numeric(18,2) := 0;
  carries_schedule boolean;
  keeps_schedule boolean;
  new_id uuid;
  new_ids uuid[] := array[]::uuid[];
begin
  if jsonb_typeof(lines) is distinct from 'array' or jsonb_array_length(lines) < 2 then
    raise exception 'A split needs at least two lines';
  end if;

  select * into original from public.transactions where id = original_id for update;
  if not found then
    raise exception 'Transaction not found';
  end if;
  if original.type = 'transfer' or original.to_account_id is not null then
    raise exception 'A transfer or a payment to another account cannot be split';
  end if;

  for line in select value from jsonb_array_elements(lines) with ordinality as t(value, position) order by position loop
    line_amount := (line.value ->> 'amount')::numeric(18,2);
    line_description := btrim(coalesce(line.value ->> 'description', ''));
    if line_amount is null or line_amount <= 0 then
      raise exception 'Every split line needs an amount above zero';
    end if;
    if line_description = '' then
      raise exception 'Every split line needs a description';
    end if;
    line_total := line_total + line_amount;
  end loop;

  if line_total <> original.amount then
    raise exception 'The split lines add up to % but the transaction is %', line_total, original.amount;
  end if;

  carries_schedule := original.is_recurring
    and original.recurrence_interval is not null
    and not original.recurrence_next_posted;

  for line in select value, position from jsonb_array_elements(lines) with ordinality as t(value, position) order by position loop
    line_category := nullif(line.value ->> 'category_id', '')::uuid;
    keeps_schedule := carries_schedule and line.position = 1;
    insert into public.transactions (
      user_id, account_id, to_account_id, category_id, subcategory_id, type, amount,
      currency, exchange_rate, description, notes, date, transfer_fee,
      is_recurring, recurrence_interval, recurrence_end_date, recurrence_next_posted,
      receipt_url, tags, goal_id
    ) values (
      original.user_id,
      original.account_id,
      null,
      line_category,
      -- a subcategory belongs to one category, so it only carries where the category does
      case when line_category is not distinct from original.category_id then original.subcategory_id end,
      original.type,
      (line.value ->> 'amount')::numeric(18,2),
      original.currency,
      original.exchange_rate,
      btrim(line.value ->> 'description'),
      original.notes,
      original.date,
      null,
      keeps_schedule,
      case when keeps_schedule then original.recurrence_interval end,
      case when keeps_schedule then original.recurrence_end_date end,
      false,
      original.receipt_url,
      original.tags,
      original.goal_id
    )
    returning id into new_id;
    new_ids := new_ids || new_id;
  end loop;

  delete from public.transactions where id = original_id;

  return new_ids;
end;
$$;

revoke all on function public.split_transaction(uuid, jsonb) from public;
grant execute on function public.split_transaction(uuid, jsonb) to authenticated;
