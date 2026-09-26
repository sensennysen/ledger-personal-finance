-- LED-134: new profiles open Home in the designed widget order (DEFAULT_WIDGET_ORDER in
-- src/hooks/useDashboardPrefs.ts): Upcoming Bills first and Recent Transactions present.
-- The old default put Upcoming Bills sixth and omitted recentTransactions, and every new
-- profile got it, so the code default never applied.
-- Existing rows that still hold the old default exactly are moved to the new one; any
-- customised order is untouched. Re-running is a no-op: once the rows are moved, none
-- equals the old default, and setting the default again changes nothing.
alter table public.profiles
  alter column dashboard_widget_order set default '["upcomingBills","stats","creditCards","budgets","recentTransactions","cashflowChart","categoryPie","cashflowForecast"]'::jsonb;

update public.profiles
set dashboard_widget_order = '["upcomingBills","stats","creditCards","budgets","recentTransactions","cashflowChart","categoryPie","cashflowForecast"]'::jsonb
where dashboard_widget_order = '["stats","creditCards","cashflowChart","categoryPie","budgets","upcomingBills","cashflowForecast"]'::jsonb;
