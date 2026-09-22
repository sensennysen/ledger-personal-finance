# LED-51 — Empty ≠ filtered-empty

## Pattern
Each of the 4 screens splits its empty-list branch into "no records ever" vs "records exist but the
current view excludes them all" by comparing an unscoped/lightly-scoped count against the fully-filtered
count, rather than a single boolean:
- `TransactionsPage` / `AccountTransactionsPage`: `transactions.length` (or `accountTransactions.length`)
  vs `filtered.length`. `TransactionsPage` additionally splits the filtered-empty case into "cycle window
  itself is empty" (`cycleOnly.length === 0`, action = try adjacent cycle) vs "type/search/tag narrowed a
  non-empty cycle to zero" (action = clear filters / Show all N) — these need different actions, so one
  boolean isn't enough there.
- `ReportsPage`: `transactions.length` (all-time) vs `filtered.length` (period-scoped).
- `ThirteenthMonthPage`: the existing `transactions` fetch is already server-scoped to `{ startDate,
  endDate, type: 'income' }` for the selected year, so it can't answer "does this user have income at
  all" by itself. Added a second `useTransactions({ type: 'income', limit: 1 })` call purely as an
  existence check — cheap, reuses the hook's existing `limit` filter, no hook changes needed.

## Decisions
- Message wording mirrors the AC's literal example ("No income in Sep 1 – Sep 30") rather than a generic
  "no results match your filters" — the date range is always included when the exclusion is at least
  partly cycle/period-driven, using the same short-date `label()` format `CycleStepper.tsx` already uses.
- "Try adjacent cycle" / "try previous period" reuse `CycleStepper.move()`'s exact month-shift arithmetic
  (`new Date(year, month - 1 + delta, 1)`) rather than adding a shared helper — 3 near-identical 4-line
  blocks (`TransactionsPage`, `ReportsPage`) felt below the threshold for extracting a shared utility,
  especially since `ThirteenthMonthPage`'s equivalent ("try adjacent year") is a different shape entirely
  (`handleYearChange`, bounded by `YEAR_OPTIONS`).
- `AccountTransactionsPage`'s "no records" action set includes Import CSV via
  `navigate('/transactions?import=1')`, not a local dialog — this page has no CSV import UI of its own,
  and LED-41 already established that convention (Import CSV always lands on `/transactions`).
- Reports and 13th Month's "no records ever" state has no action (unlike Transactions/AccountTransactions)
  — both are read-only reporting pages with no transaction-entry UI to trigger inline. Revisit if a future
  ticket wants a "Go to Transactions" link there.
- `TransactionsPage`/`AccountTransactionsPage`'s filtered-empty title falls back to "No transactions" (not
  a specific noun) when the exclusion comes from search/tag alone rather than the type tabs — the AC only
  gives a type-filter example, so no spec wording exists for that combination.

## Acceptance
- All 8 branches (4 files × no-records/filtered-empty) implemented per the AC's message/action matrix:
  PASS by code, `pnpm lint` / `pnpm build` / `pnpm test` (126/126 + `redesign.mjs`) all green.
- None of the 8 branches seen rendered in a browser — the only reachable dev server belonged to an
  already-running session against real Supabase data; mutating it (deleting/filtering real transactions
  to force each empty state) felt like the same unnecessary-mutation risk LED-50's retro flagged for
  `BudgetHistoryCard`. Deferred to the backlog below instead.

## Backlog
- Visual verification of all 8 empty/filtered-empty states needs a seeded local Supabase instance
  (`pnpm db:start` / `pnpm dev:all`) rather than the live account, so states can be forced without
  touching real data.
- The "No transactions matching your filters" fallback (search/tag-only exclusion, no type filter) has no
  spec example to check against — worth a design pass if it reads oddly next to the type-filtered wording.
- Reports/13th Month's "nothing recorded yet" state has no CTA; consider a "Go to Transactions" link if a
  future ticket extends §4.3's first-run work to these screens.
