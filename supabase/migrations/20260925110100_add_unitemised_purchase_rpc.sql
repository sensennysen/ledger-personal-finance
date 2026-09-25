-- LED-131: itemise a loan's unitemised debt as a financed purchase, atomically.
-- Adding a purchase raises the loan's owed amount by what is left to pay on it
-- (update_loan_account_for_purchase), so on its own it can never close a gap between
-- what the loan owes and what its purchases account for. This function inserts the
-- purchase and lowers the loan's owed amount by that gap in one transaction, so the
-- two figures agree afterwards whatever rate, term or opening progress the purchase has.
--
-- The gap is computed here, under a lock on the account row, from the same figures the
-- client shows: owed = max(0, -balance); itemised = the sum of what is left to pay on
-- each purchase. A stale client therefore cannot lower the balance by a gap that has
-- already been closed.
--
-- SECURITY INVOKER: row level security applies. The purchase belongs to the account's
-- owner, never to a user id in the payload, and the existing purchase triggers still
-- check that the account is a loan and the category is the owner's expense category.
--
-- p_purchase: { name, category_id, principal_amount, term_months, monthly_interest_rate,
--   monthly_installment, opening_installments_paid, opening_paid_amount, first_due_date, notes }
create or replace function public.add_unitemised_purchase(p_account_id uuid, p_purchase jsonb)
returns public.loan_purchases
language plpgsql
security invoker
set search_path = public
as $$
declare
  loan public.accounts%rowtype;
  owed numeric(18,2);
  itemised numeric(18,2);
  gap numeric(18,2);
  installment numeric(18,2);
  months integer;
  created public.loan_purchases%rowtype;
begin
  select * into loan from public.accounts where id = p_account_id for update;
  if not found then
    raise exception 'Account not found';
  end if;
  if loan.type <> 'loan' then
    raise exception 'Only a loan account can have financed purchases';
  end if;

  owed := greatest(0, -loan.balance);
  select coalesce(sum(greatest(lp.total_payable - public.loan_purchase_paid_amount(lp.id), 0)), 0)
    into itemised
    from public.loan_purchases lp
    where lp.account_id = p_account_id;
  gap := round(owed - itemised, 2);
  if gap <= 0 then
    raise exception 'This loan has no unitemised balance to add as a purchase';
  end if;

  installment := (p_purchase ->> 'monthly_installment')::numeric(18,2);
  months := (p_purchase ->> 'term_months')::integer;

  insert into public.loan_purchases (
    user_id, account_id, category_id, name, principal_amount, term_months,
    monthly_interest_rate, monthly_installment, total_payable,
    opening_installments_paid, opening_paid_amount, first_due_date, notes
  ) values (
    loan.user_id,
    p_account_id,
    nullif(p_purchase ->> 'category_id', '')::uuid,
    btrim(p_purchase ->> 'name'),
    (p_purchase ->> 'principal_amount')::numeric(18,2),
    months,
    coalesce((p_purchase ->> 'monthly_interest_rate')::numeric, 0),
    installment,
    round(installment * months, 2),
    coalesce((p_purchase ->> 'opening_installments_paid')::integer, 0),
    coalesce((p_purchase ->> 'opening_paid_amount')::numeric(18,2), 0),
    (p_purchase ->> 'first_due_date')::date,
    nullif(p_purchase ->> 'notes', '')
  )
  returning * into created;

  -- The insert trigger raised the owed amount by what is left to pay on the purchase;
  -- taking the old gap back off leaves the loan owing itemised + that purchase, no more.
  update public.accounts set balance = balance + gap where id = p_account_id;

  return created;
end;
$$;

revoke all on function public.add_unitemised_purchase(uuid, jsonb) from public;
grant execute on function public.add_unitemised_purchase(uuid, jsonb) to authenticated;
