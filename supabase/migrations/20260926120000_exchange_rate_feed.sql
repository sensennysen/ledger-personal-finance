-- LED-136: exchange rates from a live feed, refreshed as often as the user chooses, and the
-- original amount kept on a converted import.
--
-- profiles.exchange_rate_refresh: how often Ledger fetches rates on its own.
--   'open'   every time the app is opened
--   'daily'  once a day (the default)
--   'weekly' once a week
--   'manual' only when the user presses Refresh now
alter table public.profiles
  add column if not exists exchange_rate_refresh text not null default 'daily';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_exchange_rate_refresh_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_exchange_rate_refresh_check
      check (exchange_rate_refresh in ('open', 'daily', 'weekly', 'manual'));
  end if;
end $$;

-- exchange_rates.fetched_at: when the feed was last read. updated_at also moves when the user
-- edits an override, so it cannot say when the next refresh is due. `rates` holds units of each
-- currency per 1 unit of `base`; `overrides` uses the same units and wins over `rates`.
alter table public.exchange_rates
  add column if not exists fetched_at timestamptz;

-- The statement amount and currency of a converted import row. `amount` is in the account's
-- currency, so a second import of the same statement at another rate no longer matches it; the
-- original does, and duplicate detection compares it.
alter table public.transactions
  add column if not exists original_amount numeric(18, 2),
  add column if not exists original_currency text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_original_amount_check'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_original_amount_check
      check (
        (original_amount is null and original_currency is null)
        or (original_amount is not null and original_amount > 0 and original_currency is not null)
      );
  end if;
end $$;
