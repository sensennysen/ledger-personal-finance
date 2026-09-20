-- Objects that exist in prod but were never captured in a migration.
create table if not exists public.exchange_rates (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  base text not null default 'USD',
  rates jsonb not null default '{}'::jsonb,
  overrides jsonb not null default '{}'::jsonb,
  as_of date,
  updated_at timestamptz not null default now()
);

alter table public.exchange_rates enable row level security;

drop policy if exists "Users can manage own exchange rates" on public.exchange_rates;
create policy "Users can manage own exchange rates" on public.exchange_rates
  using (auth.uid() = user_id);

drop trigger if exists set_exchange_rates_updated_at on public.exchange_rates;
create trigger set_exchange_rates_updated_at
  before update on public.exchange_rates
  for each row execute function public.set_updated_at();

grant all on table public.exchange_rates to anon, authenticated, service_role;

alter table public.transactions
  drop constraint if exists transactions_exchange_rate_positive,
  add constraint transactions_exchange_rate_positive check (exchange_rate > 0),
  drop constraint if exists transactions_no_self_transfer,
  add constraint transactions_no_self_transfer
    check (to_account_id is null or to_account_id <> account_id) not valid;
