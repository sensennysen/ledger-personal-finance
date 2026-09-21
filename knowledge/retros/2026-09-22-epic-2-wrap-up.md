# Epic 2 — Navigation shell wrap-up (LED-30 to LED-34)

## Outcome
All five tickets are implemented and marked Done in `epic-2-navigation-shell-tasks.csv`. `pnpm lint`, `pnpm build` and `pnpm test` (102 tests) pass on `redesign-m3`. Nothing was checked in a browser.

## Commits
- LED-30: `7b7d5c2`, `3f21fbf`, `25b8efc`, `9079344`, `f660a9d`
- LED-32: `bad37e2`
- LED-34, LED-33, LED-31: one commit each, in that order, after LED-32.

## Backlog (all unverified)
- Browser pass (needs Supabase and auth): shell at 1920 / 1024 / 768 / 390, row 1 crowding at 390, tab-strip scroll and active tab into view, keyboard focus order including the 13th Month `xl:order-*` swap, and the shell rendering before data loads.
- Mobile: last rows of Transactions, Accounts and Budgets against the FAB after the 176px -> 88px padding cut.
- `/accounts/:id` and `/thirteenth-month` show the row-2 title and a page `<h1>` at md+. Decide whether row 2 takes the account name.
- Reports cards left alone on a wide row at 1920 were not audited.
- `undo-toast` (`bottom-18`) overlaps the 88px bottom nav. Pre-existing.
- No test covers `AppLayout` geometry.

## Hand-offs
- LED-40: search field is a disabled placeholder, no Cmd+K listener.
- LED-100: dark token pair audit is unblocked by LED-32. "System" theme option is out of scope.
- Categories, Transactions and AccountTransactions keep `max-w-3xl`; not in LED-33's scope.
