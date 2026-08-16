-- Loan accounts no longer own a category. Categories belong to financed
-- purchase records and repayment expense transactions instead.
drop trigger if exists trg_accounts_loan_category_ownership on public.accounts;
drop function if exists public.enforce_account_loan_category_ownership();
drop index if exists public.accounts_loan_category_idx;
alter table public.accounts drop constraint if exists accounts_loan_category_id_fkey;
alter table public.accounts drop column if exists loan_category_id;

create or replace function public.enforce_loan_repayment_destination()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.to_account_id is not null and new.type = 'expense' and not exists (
    select 1 from public.accounts a where a.id = new.to_account_id and a.type = 'loan'
  ) then
    raise exception 'Expense destination must be a loan account';
  end if;
  if new.to_account_id is not null and new.type not in ('expense', 'transfer') then
    raise exception 'Only expenses and transfers can have a destination account';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_loan_repayment_destination on public.transactions;
create trigger trg_loan_repayment_destination
  before insert or update of type, to_account_id on public.transactions
  for each row execute procedure public.enforce_loan_repayment_destination();
