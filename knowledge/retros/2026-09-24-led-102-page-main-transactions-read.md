# LED-102 · Page the main transactions read — retro (2026-09-24)

Found in the pre-PR code review of epic-5-density, and already listed in the LED-101 backlog. `useTransactions` read every matching row in one request, so past 1,000 transactions the month jump rail, the result bar total, all-time search and Reports quietly left out the oldest rows.

## What shipped
- `useTransactions`: with no `limit`, the read goes through `readAllPages`. The order is date desc, created_at desc, then id desc, so pages don't overlap. If any page fails, the hook sets `error` and keeps the previous list rather than showing a partial one.
- A caller that passes `limit` (ThirteenthMonth's "any income ever" probe) still makes a single request.
- `page-reads-past-1000-rows.md` now lists `useTransactions`.

## Acceptance criteria
- (a) With no limit, the hook returns every row past 1,000: PASS by code. It uses the same `readAllPages` that LED-101 checked live with 1,500 rows. Not checked live for this hook.
- (b) A failure on any page sets error, not a partial list: PASS by code.
- (c) A `limit` still means one request: PASS by code.
- (d) Lint, build and test pass: PASS (196/196).

## Backlog
- Not seen in the browser with more than 1,000 seeded transactions: Activity, Account detail, the month rail oldest month, all-time search, Reports.
- A large history is now loaded in full on every mount and refetch. That is one request per 1,000 rows, on Dashboard, Reports, Activity, AppLayout and QuickEntry each. Watch load time. If it hurts, fetch the history once and share it.
- `generateDueRecurring` reads recurring transactions without paging (under 1,000 rows is realistic). Still not audited: Reports and dashboard hooks that query `transactions` directly.
