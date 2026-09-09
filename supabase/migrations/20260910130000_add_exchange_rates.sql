-- Multi-currency support: store USD-anchored exchange rates per user so that
-- cross-currency totals (net worth, cash flow, budgets, reports) can be
-- expressed in one display currency instead of adding raw amounts.
--
--   rates      – auto-fetched map, USD value of 1 unit of each ISO code
--                e.g. { "EUR": 1.08, "PHP": 0.0175 }; "USD" is implicitly 1
--   overrides  – manual corrections that win over `rates` for the same code
--   as_of      – date the auto-fetched rates are quoted for

begin;

create table if not exists public.exchange_rates (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  base        text not null default 'USD',
  rates       jsonb not null default '{}'::jsonb,
  overrides   jsonb not null default '{}'::jsonb,
  as_of       date,
  updated_at  timestamptz not null default now()
);

alter table public.exchange_rates enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'exchange_rates'
      and policyname = 'Users can manage own exchange rates'
  ) then
    create policy "Users can manage own exchange rates"
      on public.exchange_rates
      for all
      using (auth.uid() = user_id);
  end if;
end $$;

drop trigger if exists set_exchange_rates_updated_at on public.exchange_rates;
create trigger set_exchange_rates_updated_at
  before update on public.exchange_rates
  for each row execute procedure public.set_updated_at();

commit;
