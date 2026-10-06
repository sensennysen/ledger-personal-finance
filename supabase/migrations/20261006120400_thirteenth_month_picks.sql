-- LED-267: 13th Month picks live in the database (decision C, 2026-10-05).
-- The income records picked as basic salary were a per-browser key (13th-month-selection:<user>:<year>),
-- so another device started from "every record counts".
--
-- thirteenth_month_selections records that a year's picks were saved: without it an empty pick
-- ("Clear") could not be told from "never picked", which the page shows as every record counted.
-- thirteenth_month_picks holds the picked transactions; deleting a transaction deletes its pick.
create table if not exists public.thirteenth_month_selections (
  user_id uuid not null references public.profiles(id) on delete cascade,
  year integer not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, year),
  constraint thirteenth_month_selections_year check (year between 2000 and 2100)
);

create table if not exists public.thirteenth_month_picks (
  user_id uuid not null,
  year integer not null,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  primary key (user_id, year, transaction_id),
  foreign key (user_id, year) references public.thirteenth_month_selections(user_id, year) on delete cascade
);

create index if not exists thirteenth_month_picks_transaction_idx
  on public.thirteenth_month_picks (transaction_id);

alter table public.thirteenth_month_selections enable row level security;
alter table public.thirteenth_month_picks enable row level security;

drop policy if exists "Users can manage own 13th month selections" on public.thirteenth_month_selections;
create policy "Users can manage own 13th month selections"
  on public.thirteenth_month_selections
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage own 13th month picks" on public.thirteenth_month_picks;
create policy "Users can manage own 13th month picks"
  on public.thirteenth_month_picks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant all on table public.thirteenth_month_selections to authenticated, service_role;
grant all on table public.thirteenth_month_picks to authenticated, service_role;

-- Replaces a year's picks in one statement, so a failure leaves the old picks whole. Ids that are not
-- the caller's transactions are dropped. With p_only_if_absent, a year that already has saved picks
-- is left as it is: the one-time upload of a browser's old key, which a second device cannot repeat.
-- Returns whether the picks were written.
create or replace function public.set_thirteenth_month_picks(p_year integer, p_ids uuid[], p_only_if_absent boolean default false)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;

  if p_only_if_absent then
    insert into public.thirteenth_month_selections (user_id, year)
    values (uid, p_year)
    on conflict (user_id, year) do nothing;
    if not found then
      return false;
    end if;
  else
    insert into public.thirteenth_month_selections (user_id, year)
    values (uid, p_year)
    on conflict (user_id, year) do update set updated_at = now();
    delete from public.thirteenth_month_picks where user_id = uid and year = p_year;
  end if;

  insert into public.thirteenth_month_picks (user_id, year, transaction_id)
  select uid, p_year, t.id
    from public.transactions t
   where t.user_id = uid
     and t.id = any(coalesce(p_ids, '{}'::uuid[]))
  on conflict do nothing;
  return true;
end;
$$;

revoke all on function public.set_thirteenth_month_picks(integer, uuid[], boolean) from public;
grant execute on function public.set_thirteenth_month_picks(integer, uuid[], boolean) to authenticated;
