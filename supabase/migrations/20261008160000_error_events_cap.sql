-- LED-328: error reports cannot fill the database.
-- Any signed-in user could insert error_events rows without limit. The client gate
-- (createReportGate in src/lib/errorReport.ts) only bounds a well-behaved client: a loop in an old
-- build, or a user calling the API directly, could fill the table and the project's quota.
--
-- A BEFORE INSERT trigger keeps each user to 60 reports in a rolling hour; past that, a report is
-- dropped (the insert succeeds and stores nothing, so the client's fire-and-forget send does not
-- start logging failures). The same trigger removes that user's reports older than 90 days, so the
-- table stays bounded without a scheduled job. Bounds are per user, so one user cannot use up
-- another's allowance.
--
-- SECURITY DEFINER: a user cannot read error_events (insert-only, LED-258), so counting and pruning
-- their own rows needs the owner's rights. It only ever touches rows of new.user_id, which the
-- insert policy has already checked is auth.uid().

create index if not exists error_events_user_created_idx on public.error_events (user_id, created_at);

create or replace function public.error_events_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.error_events
   where user_id = new.user_id
     and created_at < now() - interval '90 days';

  if (
    select count(*) from public.error_events
     where user_id = new.user_id
       and created_at > now() - interval '1 hour'
  ) >= 60 then
    return null;
  end if;

  return new;
end;
$$;

revoke all on function public.error_events_cap() from public;

drop trigger if exists trg_error_events_cap on public.error_events;
create trigger trg_error_events_cap
  before insert on public.error_events
  for each row execute function public.error_events_cap();
