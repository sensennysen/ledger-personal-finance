-- Prod's public.accounts has loan columns that no earlier migration creates.
-- Idempotent, so it is a no-op wherever the columns already exist.
alter table public.accounts
  add column if not exists loan_original_amount numeric,
  add column if not exists loan_due_day smallint,
  add column if not exists loan_due_day_secondary smallint;

alter table public.accounts
  drop constraint if exists accounts_loan_due_day_check,
  add constraint accounts_loan_due_day_check
    check (loan_due_day is null or (loan_due_day >= 1 and loan_due_day <= 31)),
  drop constraint if exists accounts_loan_due_day_secondary_check,
  add constraint accounts_loan_due_day_secondary_check
    check (loan_due_day_secondary is null or (loan_due_day_secondary >= 1 and loan_due_day_secondary <= 31));

comment on column public.accounts.loan_original_amount is 'Original positive principal of the loan.';
comment on column public.accounts.loan_due_day is 'Primary day of month on which payment is due.';
comment on column public.accounts.loan_due_day_secondary is 'Second day of month for semimonthly payments.';

-- Prod stores this as smallint; the baseline created it as integer.
alter table public.accounts
  alter column loan_due_weekday type smallint;
