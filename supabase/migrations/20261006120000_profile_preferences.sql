-- LED-263: preferences live in the database (decision C, 2026-10-05).
-- Number locale, date format, large-transaction threshold, card notifications, and the transaction
-- and account list views were one browser-wide local storage key (ledger-preferences), so they never
-- reached another device and the next person to sign in on the same browser inherited them.
--
-- `preferences` holds only what the user changed; the client merges its defaults over it and checks
-- each value on read. `{}` means nothing was ever written, which is what lets a browser's old key be
-- uploaded exactly once. RLS is the profiles policy: a user reads and updates only their own row.
alter table public.profiles
  add column if not exists preferences jsonb not null default '{}'::jsonb;

alter table public.profiles
  drop constraint if exists profiles_preferences_is_object;
alter table public.profiles
  add constraint profiles_preferences_is_object check (jsonb_typeof(preferences) = 'object');

-- Changes only the keys in p_patch, so two devices changing different settings keep both changes.
-- With p_only_if_empty, the patch applies only to an account that never wrote a preference: the
-- one-time upload of a browser's old key, which a second device or a second tab then cannot repeat.
-- Returns the stored preferences.
create or replace function public.merge_profile_preferences(p_patch jsonb, p_only_if_empty boolean default false)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  merged jsonb;
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Preferences must be an object';
  end if;

  update public.profiles
     set preferences = case
           when p_only_if_empty and preferences <> '{}'::jsonb then preferences
           else preferences || p_patch
         end
   where id = auth.uid()
  returning preferences into merged;

  if not found then
    raise exception 'Profile not found';
  end if;
  return merged;
end;
$$;

revoke all on function public.merge_profile_preferences(jsonb, boolean) from public;
grant execute on function public.merge_profile_preferences(jsonb, boolean) to authenticated;
