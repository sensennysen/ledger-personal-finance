-- LED-327: a balance edit lands on the balance the user typed, whatever the server holds.
-- The account form computed the adjustment on the client, from the balance it had cached, and
-- inserted it in a second call. A change from another device or the offline queue in between
-- made the adjustment wrong (cached 400, server 450, typed 500: +100 gave 550).
--
-- set_account_balance locks the account and inserts the difference between the balance typed and
-- the balance locked, as an income or expense the balance trigger applies. Concurrent edits queue
-- on the row lock. A replay after a lost response finds the balance already there and adds nothing.
--
-- SECURITY INVOKER: row level security applies. The owner and currency come from the locked
-- account, never the caller, and an account RLS hides answers "not found".

create or replace function public.set_account_balance(
  p_account_id uuid,
  p_balance numeric,
  p_description text,
  p_date date
)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
  acct public.accounts%rowtype;
  diff numeric(18,2);
begin
  if p_balance is null then
    raise exception 'A balance is required';
  end if;
  if p_date is null then
    raise exception 'A date is required';
  end if;

  select * into acct from public.accounts where id = p_account_id for update;
  if not found then
    raise exception 'Account not found';
  end if;

  diff := round(p_balance, 2) - acct.balance;
  if diff = 0 then
    return acct.balance;
  end if;

  insert into public.transactions (user_id, account_id, type, amount, currency, exchange_rate, description, date)
  values (
    acct.user_id, acct.id, case when diff > 0 then 'income' else 'expense' end, abs(diff),
    acct.currency, 1, coalesce(nullif(btrim(p_description), ''), 'Balance Adjustment'), p_date
  );

  select balance into acct.balance from public.accounts where id = acct.id;
  return acct.balance;
end;
$$;

revoke all on function public.set_account_balance(uuid, numeric, text, date) from public;
grant execute on function public.set_account_balance(uuid, numeric, text, date) to authenticated;
