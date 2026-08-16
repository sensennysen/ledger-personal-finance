alter table public.accounts
  add column if not exists loan_pay_period text,
  add column if not exists loan_due_days integer[],
  add column if not exists loan_due_weekday integer;

alter table public.accounts
  drop constraint if exists accounts_loan_pay_period_check,
  add constraint accounts_loan_pay_period_check
    check (loan_pay_period is null or loan_pay_period in (
      'monthly', 'twice_monthly', 'weekly', 'daily', 'quarterly', 'bi_yearly', 'yearly'
    )),
  drop constraint if exists accounts_loan_due_days_check,
  add constraint accounts_loan_due_days_check
    check (
      loan_due_days is null or cardinality(loan_due_days) between 1 and 2
    ),
  drop constraint if exists accounts_loan_due_weekday_check,
  add constraint accounts_loan_due_weekday_check
    check (loan_due_weekday is null or loan_due_weekday between 0 and 6);

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

-- A loan repayment is recorded as an expense from a cash/bank account with
-- the loan account in to_account_id. It remains visible in expense reporting
-- while reducing both cash and the outstanding (negative) loan balance.
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
        update accounts set balance = balance - (old.amount * old.exchange_rate) where id = old.to_account_id;
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
        update accounts set balance = balance + (new.amount * new.exchange_rate) where id = new.to_account_id;
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
