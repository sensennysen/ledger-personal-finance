# LED-132 · Page the remaining transaction reads — retro (2026-09-25)

LED-101 and LED-102 paged budget spend, goal contributions and the main transactions read, and left the rest unaudited. PostgREST returns at most 1,000 rows and does not error, so any read left unpaged undercounts silently.

## What shipped
- `readAllPages` takes an optional third argument, a cancel check, tested after each page. Once true it stops paging and returns what it has; the caller that cancelled discards it. The result shape is unchanged (the plan added a `cancelled` field; it was not needed, since every caller already checks its own request id).
- `useOverspending`: the inline paging loop is replaced by `readAllPages`, stopping when its request id is superseded.
- `useImportDuplicates`: already used `readAllPages` (the ticket and rule doc were stale); it now passes its effect's `cancelled` flag.
- `useBudgets`: passes a stale-request check into `readAllPages`, so it stops mid-paging instead of loading every page and discarding the result.
- `useTransactions.generateDueRecurring`: reads recurring transactions through `readAllPages` (date desc, id desc). A failed read returns 0 instead of reading as "nothing due", and a partial list can no longer skip a series.
- `page-reads-past-1000-rows.md` lists every paged hook and the cancel check.
- `tests/pagedRead.test.mjs`: totals over 2,500 rows, a failed third page, cancel stops paging, a never-true cancel reads everything, a page error after cancellation is dropped.

## Audit: every `from('transactions')` read
Searched `src` for `from('transactions')`, the double-quoted and template forms, and multi-line `.from(`. The only dynamic table is `offlineQueue` (`from(item.table)`), which writes.

| Read | Status |
|---|---|
| `useTransactions` main read (`:69`) | Paged (`readAllPages`); with an explicit `filters.limit` it is one bounded request |
| `useTransactions.generateDueRecurring` (`:301`) | Paged now |
| `useBudgets` | Paged; cancel check added |
| `useSavingsGoals` (linked contributions) | Paged |
| `useImportCategoryMemory` | Paged |
| `useImportDuplicates` | Paged; cancel check added |
| `useOverspending` | Paged now, through `readAllPages` |
| `useDescriptionSuggestions` | Bounded: `.limit(500)` by design (recent descriptions only) |
| `useAccounts` (`:139`) | Bounded: `head` count, no rows |
| `offlineQueue` conflict check | Bounded: one row by id (`select('updated_at')`) |
| `ReportsPage`, `ThirteenthMonthPage`, `useDashboardData` | No direct read; they use `useTransactions` (paged) |
| Inserts, updates and deletes in `useTransactions`, `useAccounts`, `offlineQueue` | Writes, not reads |

## Acceptance criteria
- (a) Retro lists every read with its paging status: PASS (table above).
- (b) Each unpaged read pages or is documented as bounded: PASS.
- (c) A failing page sets error, not a partial list: PASS by test in `tests/pagedRead.test.mjs` (`readAllPages` returns the error); each caller sets its load failure on it.
- (d) `useOverspending` and `useImportDuplicates` use `readAllPages`; it accepts a cancel check: PASS.
- (e) Totals correct past 1,000 rows on a paged fake: PASS.
- (f) Lint, build and test pass: PASS (397/397).

## Backlog
- Not checked live with more than 1,000 rows: Overspending, Import duplicate check, Budgets, recurring generation. LED-125 seeds 2,000 rows.
- LED-102's warning stands: a large history is loaded in full on every mount on Dashboard, Reports, Activity and AppLayout. Not measured here; LED-125 measures, and a shared fetch through the cache is the fix if it hurts.
- `useSavingsGoals`, `useImportCategoryMemory` and `useTransactions` do not pass a cancel check. Their callers already discard stale results, so this only saves wasted pages. Not in scope.
- `generateDueRecurring` still reads every recurring row on each AppLayout mount; recurring rows are few, so paging is a safeguard, not a cost.
