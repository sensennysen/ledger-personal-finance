-- LED-264: which Home widgets are hidden lives in the database (decision C, 2026-10-05).
-- The order was already profiles.dashboard_widget_order; the hidden ones were only a browser key
-- (ledger-dashboard-widgets), so a hidden widget came back on every other device.
--
-- The list names the hidden widgets, so a widget added later shows by default. Null means the
-- account never stored one: a browser's old key uploads only then (`... where dashboard_hidden_widgets
-- is null`, one statement), so a second device or tab cannot upload it again. RLS is the profiles policy.
alter table public.profiles
  add column if not exists dashboard_hidden_widgets jsonb;

alter table public.profiles
  drop constraint if exists profiles_dashboard_hidden_widgets_is_array;
alter table public.profiles
  add constraint profiles_dashboard_hidden_widgets_is_array
  check (dashboard_hidden_widgets is null or jsonb_typeof(dashboard_hidden_widgets) = 'array');
