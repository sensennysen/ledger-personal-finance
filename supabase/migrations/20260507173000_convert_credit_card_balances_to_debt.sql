begin;

-- Historical note:
-- Earlier versions effectively treated `accounts.balance` for credit cards as
-- "available credit" (positive remaining credit). With liability-based bookkeeping,
-- `accounts.balance` should represent "amount currently owed" and therefore be <= 0.
--
-- Conversion:
--   debt = -(credit_limit - available_credit) = available_credit - credit_limit
update public.accounts
set balance = balance - credit_limit
where type = 'credit_card'
  and credit_limit is not null
  and balance >= 0;

commit;
