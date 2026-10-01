-- LED-130: split a transaction in one atomic call.
-- The client used to insert each line and then delete the original as separate
-- requests, so a failure part-way left partial lines (or both, counting the amount
-- twice) and dropped tags, receipt, subcategory and goal.
--
-- SECURITY INVOKER: row level security applies, so a user can only split their own
-- transaction. The account-balance triggers fire per row: n inserts of -amount and
-- one delete of +amount, so an income or expense nets to zero across the split.
-- A transfer, or any transaction that moves money to another account (a loan
-- repayment, a card payment), is refused: its destination and loan allocations
-- cannot be carried onto the lines.
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

  for line in select value from jsonb_array_elements(lines) with ordinality as t(value, position) order by position loop
    line_category := nullif(line.value ->> 'category_id', '')::uuid;
    insert into public.transactions (
      user_id, account_id, to_account_id, category_id, subcategory_id, type, amount,
      currency, exchange_rate, description, notes, date, transfer_fee,
      is_recurring, recurrence_interval, recurrence_end_date, receipt_url, tags, goal_id
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
      false,
      null,
      null,
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
