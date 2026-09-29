-- LED-138: Activity filters a user saves and reaches from the search palette (29a).
-- One row per saved filter. `filter` is the versioned JSON the client writes
-- ({ "v": 1, "type", "search", "tag" }); the client validates it on read, so an
-- unknown version is skipped rather than trusted. Names are unique per user,
-- ignoring case and surrounding spaces.
create table if not exists public.saved_filters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  filter jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_filters_name_length check (char_length(btrim(name)) between 1 and 60),
  constraint saved_filters_filter_is_object check (jsonb_typeof(filter) = 'object')
);

create unique index if not exists saved_filters_user_name_key
  on public.saved_filters (user_id, lower(btrim(name)));

alter table public.saved_filters enable row level security;

drop policy if exists "Users can manage own saved filters" on public.saved_filters;
create policy "Users can manage own saved filters"
  on public.saved_filters
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_saved_filters_updated_at on public.saved_filters;
create trigger set_saved_filters_updated_at
  before update on public.saved_filters
  for each row execute function public.set_updated_at();

grant all on table public.saved_filters to authenticated, service_role;
