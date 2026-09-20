-- LED-20: global budget deficit behaviour.
-- Existing users keep today's behaviour ('carry'); new users default to 'reset'.
-- Add the column with default 'carry' so existing rows backfill, then flip the
-- default for rows created from now on. Re-running is a no-op: the add is
-- guarded, so the backfill never repeats.
alter table public.profiles
  add column if not exists budget_deficit_behaviour text not null default 'carry';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_budget_deficit_behaviour_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_budget_deficit_behaviour_check
      check (budget_deficit_behaviour in ('carry', 'reset'));
  end if;
end $$;

alter table public.profiles
  alter column budget_deficit_behaviour set default 'reset';
