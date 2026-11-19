alter table public.transactions
  add column entry_source text not null default 'manual'
    check (entry_source in ('manual', 'ai_phrase')),
  add column reviewed_at timestamptz,
  add column destination_currency text;

create function public.check_quick_log_accounts()
returns trigger language plpgsql set search_path = '' as $$
declare
  source_account record;
  destination record;
begin
  if new.entry_source <> 'ai_phrase' or new.reviewed_at is not null then
    return new;
  end if;

  -- Lock both rows in the same order before checking them and applying balance changes.
  perform 1 from public.accounts
   where id in (new.account_id, new.to_account_id) and user_id = new.user_id
   order by id for no key update;

  select is_active, currency, type into source_account
    from public.accounts where id = new.account_id and user_id = new.user_id;
  if not found or not source_account.is_active or source_account.currency <> new.currency
     or source_account.type = 'loan'
     or (new.type <> 'expense' and source_account.type = 'credit_card') then
    raise exception 'Choose an active account in the transaction currency.' using errcode = '23514';
  end if;

  if new.type = 'transfer' then
    select is_active, currency, type into destination
      from public.accounts where id = new.to_account_id and user_id = new.user_id;
    if not found or not destination.is_active or destination.type in ('loan', 'credit_card')
       or new.account_id = new.to_account_id
       or destination.currency is distinct from new.destination_currency
       or ((destination.currency <> new.currency) <> (new.destination_amount is not null)) then
      raise exception 'Check the destination account, currency and amount received.' using errcode = '23514';
    end if;
  elsif new.to_account_id is not null then
    raise exception 'Confirm this payment in the transaction form.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger trg_quick_log_accounts
  before insert on public.transactions
  for each row execute function public.check_quick_log_accounts();

create schema if not exists private;
create table private.quick_log_quota (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  used integer not null
);
alter table private.quick_log_quota enable row level security;
grant usage on schema private to service_role;
grant select, insert, update on private.quick_log_quota to service_role;

create function public.consume_quick_log_quota(p_user_id uuid, p_limit integer)
returns boolean language plpgsql set search_path = '' as $$
declare
  current_time_window timestamptz := pg_catalog.date_trunc('minute', statement_timestamp());
begin
  insert into private.quick_log_quota as quota (user_id, window_start, used)
  values (p_user_id, current_time_window, 1)
  on conflict (user_id) do update
    set window_start = greatest(quota.window_start, excluded.window_start),
        used = case when quota.window_start < excluded.window_start then 1 else quota.used + 1 end
    where quota.window_start < excluded.window_start or quota.used < p_limit;
  return found;
end;
$$;

revoke execute on function public.consume_quick_log_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_quick_log_quota(uuid, integer) to service_role;
