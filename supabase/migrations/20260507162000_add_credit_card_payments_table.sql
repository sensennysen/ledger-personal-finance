begin;

create table if not exists public.credit_card_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  amount numeric(18,2) not null check (amount > 0),
  payment_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.credit_card_payments enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'credit_card_payments'
      and policyname = 'Users can manage own credit card payments'
  ) then
    create policy "Users can manage own credit card payments"
      on public.credit_card_payments
      for all
      using (auth.uid() = user_id);
  end if;
end $$;

create index if not exists credit_card_payments_user_date_idx
  on public.credit_card_payments(user_id, payment_date desc, created_at desc);

create index if not exists credit_card_payments_account_idx
  on public.credit_card_payments(account_id);

commit;
