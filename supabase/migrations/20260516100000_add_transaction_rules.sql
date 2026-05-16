create table if not exists public.transaction_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  keyword text not null,
  category_id uuid references public.categories(id) on delete set null,
  type_hint text check (type_hint in ('income', 'expense', 'transfer')),
  priority integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.transaction_rules enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transaction_rules'
      and policyname = 'Users can manage own rules'
  ) then
    create policy "Users can manage own rules"
      on public.transaction_rules
      for all
      using (auth.uid() = user_id);
  end if;
end
$$;

create index if not exists transaction_rules_user_idx
  on public.transaction_rules(user_id);
