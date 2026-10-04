# LED-134 — Widget-order default for new profiles — retro (2026-09-26)

- OD-1 (b). `profiles.dashboard_widget_order` now defaults to `DEFAULT_WIDGET_ORDER` (Upcoming Bills first, Recent Transactions present). One migration, `20260926100000`, sets the default and updates only rows that exactly equal the old seven-key default. `supabase/schema.sql` carries the same default.
- Verified on the local database in a rolled-back transaction: an old-default row moved, a customised row was untouched, a second run changed nothing, and a new profile got the new order. A user created later in the session had the new order too.
- `tests/dashboardWidgetOrder.test.mjs` reads `DEFAULT_WIDGET_ORDER` out of `useDashboardPrefs.ts` as text and compares it with the newest migration and `schema.sql`. Node cannot load the hook (Supabase, `@/`), and moving the constant to `src/lib` for a test was a refactor the ticket did not ask for.

## Backlog
- A user who never reordered but whose row was written by the client (the hook persists on first change) is indistinguishable from a customiser; only exact matches move, as decided.
- The migration was not run against the linked remote (`pnpm db:push:remote` is never run without being asked).
