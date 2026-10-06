-- LED-258: errors reach the operator, not only the browser console.
-- The app's error boundaries and unhandled errors write one row here per failure (owner's pick of
-- sink, 2026-10-05: a table in the same Supabase project, so no new outbound host). The client
-- strips numbers, quoted text and ids from the message and the route before it sends them; no
-- amounts, names or descriptions are stored.
--
-- Insert only, own rows only: a user cannot read, change or delete reports, their own included.
-- The operator reads them with the service role (dashboard or psql). Rows go with the account.
create table if not exists public.error_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  kind text not null,
  message text not null,
  route text not null,
  release text not null,
  user_agent text not null,
  stack text,
  constraint error_events_kind check (kind in ('boundary', 'card', 'error', 'rejection')),
  constraint error_events_message_length check (char_length(message) <= 500),
  constraint error_events_route_length check (char_length(route) <= 200),
  constraint error_events_release_length check (char_length(release) <= 64),
  constraint error_events_user_agent_length check (char_length(user_agent) <= 300),
  constraint error_events_stack_length check (char_length(stack) <= 4000)
);

create index if not exists error_events_created_idx on public.error_events (created_at desc);

alter table public.error_events enable row level security;

drop policy if exists "Users can report their own errors" on public.error_events;
create policy "Users can report their own errors"
  on public.error_events
  for insert
  to authenticated
  with check (auth.uid() = user_id);

revoke all on table public.error_events from anon, authenticated;
grant insert on table public.error_events to authenticated;
grant all on table public.error_events to service_role;
