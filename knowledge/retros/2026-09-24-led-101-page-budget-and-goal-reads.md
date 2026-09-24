# LED-101 · Page the budget-spend and goal-contribution reads — retro (2026-09-24)

Found while evaluating LED-66, the note saying Budgets & Goals and Split transaction are unaffected at the density ceilings. The layouts are unaffected, and LED-66 is closed as a note. The data layer was not: two reads went past PostgREST's 1,000-row cap (commit ff05980).

## What shipped
- `src/lib/pagedRead.ts`: `readAllPages(fetchPage, pageSize = 1000)` reads until a page comes back short and stops at the first error. It is pure, so it is tested under `node --test`.
- `useBudgets`: the ~14-month expense read that feeds `spent` is paged and ordered by date, then id.
- `useSavingsGoals`: the goal-linked transactions read is paged and ordered by date desc, then id desc. Its error used to be ignored, so a failed read showed zero contributions. It now sets `error`: with no cache that renders the goals `ErrorState`, and with a cache it shows the stale-error banner.
- `page-reads-past-1000-rows.md` now points new reads at `readAllPages`.

## Acceptance criteria
- (a) Spent is correct when the read window has more than 1,000 expenses: PASS for the read, PARTIAL for the screen.
  - Five unit tests cover empty, exactly one full page, 2,350 rows and an error on page 2.
  - Live check on local Supabase with 1,500 seeded expenses (removed afterwards): one request returned 1,000 rows, and `readAllPages` returned 1,500 unique rows.
  - Not checked: the Budgets screen showing the right `spent` at that volume.
- (b) A failed contributions read shows the goals ErrorState, not zero: PASS by code (`resolveLoadState` → `BudgetsPage` goals tab). Not triggered live.
- (c) Lint, build and test pass: PASS.

## Backlog
- Not seen in the browser: `spent` on Budgets and on the Dashboard budget cards with more than 1,000 expenses in the window. The goals error path was not triggered either.
- `useBudgets` checks for a stale request only after every page has loaded. A superseded load fetches all its pages and then drops them. `useOverspending` checks after each page. Pass a cancel check into `readAllPages` if this shows up.
- `useOverspending` and `useImportDuplicates` still run the loop inline. Move them to `readAllPages` only when those files are next changed.
- Other unpaged `transactions` reads were not audited (Reports, 13th Month, dashboard hooks). Grep `from('transactions')` for reads without `.range(`.
