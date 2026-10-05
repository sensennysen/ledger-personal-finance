-- LED-265: the setup checklist state lives in the database (decision C, 2026-10-05).
-- Whether the pay cycle was confirmed and whether the checklist was dismissed were one browser-wide
-- key (ledger-first-run): a new device showed the checklist again, and the next person to sign in on
-- the same browser inherited the previous one's answers.
--
-- Each is the time it happened, null until then. They only ever go from null to a time, so the
-- one-time upload of a browser's old key (`... where <column> is null`) cannot repeat or undo
-- anything. RLS is the profiles policy.
alter table public.profiles
  add column if not exists setup_checklist_dismissed_at timestamptz,
  add column if not exists pay_cycle_confirmed_at timestamptz;
