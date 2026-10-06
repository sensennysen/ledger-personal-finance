-- LED-257: saved transaction templates belong to a user, in the database.
-- They were one local storage key (ledger_transaction_templates) with no user in it, so anyone who
-- signed in on the same browser saw the previous user's templates, and a template never reached
-- another device (decision C, 2026-10-05).
--
-- One row per template. `fields` is the versioned JSON the client writes ({ "v": 1, "type", ... }:
-- the transaction form's values without a date); the client validates it on read, so an unknown
-- version is skipped rather than trusted. (`values` is an SQL keyword, hence `fields`.)
-- The client uploads a browser's old templates once, with their own ids, so a repeated upload
-- inserts nothing.
create table if not exists public.transaction_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  fields jsonb not null,
  created_at timestamptz not null default now(),
  constraint transaction_templates_name_length check (char_length(btrim(name)) between 1 and 60),
  constraint transaction_templates_fields_is_object check (jsonb_typeof(fields) = 'object')
);

create index if not exists transaction_templates_user_idx
  on public.transaction_templates (user_id, created_at desc);

alter table public.transaction_templates enable row level security;

drop policy if exists "Users can manage own transaction templates" on public.transaction_templates;
create policy "Users can manage own transaction templates"
  on public.transaction_templates
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant all on table public.transaction_templates to authenticated, service_role;
