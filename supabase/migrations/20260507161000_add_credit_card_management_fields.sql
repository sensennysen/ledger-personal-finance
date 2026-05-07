begin;

alter table public.accounts
  add column if not exists statement_day integer,
  add column if not exists due_day integer,
  add column if not exists utilization_target_pct numeric(5,2),
  add column if not exists payment_reminder_days integer,
  add column if not exists statement_balance numeric(18,2),
  add column if not exists statement_balance_locked_at date,
  add column if not exists statement_paid_amount numeric(18,2),
  add column if not exists last_payment_amount numeric(18,2),
  add column if not exists last_payment_date date;

alter table public.accounts
  alter column payment_reminder_days set default 3;

alter table public.accounts
  alter column statement_paid_amount set default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'accounts_statement_day_check'
      and conrelid = 'public.accounts'::regclass
  ) then
    alter table public.accounts
      add constraint accounts_statement_day_check
      check (statement_day between 1 and 31);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'accounts_due_day_check'
      and conrelid = 'public.accounts'::regclass
  ) then
    alter table public.accounts
      add constraint accounts_due_day_check
      check (due_day between 1 and 31);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'accounts_utilization_target_pct_check'
      and conrelid = 'public.accounts'::regclass
  ) then
    alter table public.accounts
      add constraint accounts_utilization_target_pct_check
      check (utilization_target_pct between 1 and 100);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'accounts_payment_reminder_days_check'
      and conrelid = 'public.accounts'::regclass
  ) then
    alter table public.accounts
      add constraint accounts_payment_reminder_days_check
      check (payment_reminder_days between 0 and 30);
  end if;
end $$;

commit;
