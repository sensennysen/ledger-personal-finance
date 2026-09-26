# Epics 8-13 phase 12 · Live verification — retro (2026-09-26)

Branch `epics-8-13-phase-12`: LED-124, 125, 126, 127 (23 points), one commit each, plus one commit for epic 14 and one for the patterns. **No application code changed.** Lint, build and all 666 tests were green on the tip of phase 11 (`4ab1888`) before the sweeps and again after them.

## Ticket retros
[LED-124](2026-09-26-live-sweep-shell-search-system.md) · [LED-125](2026-09-26-live-sweep-lists-reports-import.md) · [LED-126](2026-09-26-live-sweep-accounts-home-loans-budgets-legal-login.md) · [LED-127](2026-09-26-live-sweep-transaction-kinds.md)

## Result
**155 items checked: 121 PASS, 24 FAIL, 10 not checkable.**

| Sweep | PASS | FAIL | Not checkable | New tickets |
|---|---|---|---|---|
| LED-124 shell, navigation, search, system states | 40 | 10 | 5 | LED-154 to 163 |
| LED-125 lists, reports, import | 40 | 8 | 1 | LED-164 to 171 |
| LED-126 accounts, home, loans, budgets, legal, login | 26 | 6 | 3 | LED-172 to 177 |
| LED-127 every kind on the mobile sheet | 15 | 0 | 1 | none |

Every FAIL is a ticket in epic 14 (`docs/dev-tasks/ledger-ui-redesign/epic-14-live-sweep-findings-tasks.csv`, 28 tickets, 78 points, phased in `epic-14-build-order.md`). Four extra tickets hold the backlog that needs prioritising: a real-device pass (LED-178), a screen-reader pass (LED-179), and two decisions (LED-180, LED-181).

## What the sweeps found that the suite could not
- **Layout at real sizes:** the top bar clips its right-hand tools at 1024 (LED-154); the import dialog is 746px wide in a 343px dialog on a phone (LED-169); the queue review sheet cannot be read at 390 (LED-159); the first-run checklist step is crushed at 390 (LED-158).
- **A screen that renders nothing:** the Income vs. Expenses chart on Reports > Analytics has a zero-height container (LED-168).
- **Messages that are wrong:** sign-out failure says "still signed in" while the client has already cleared the session (LED-162); "A account" (LED-176); the account select in Import shows a UUID (LED-170).
- **Numbers that disagree:** Assets, Liabilities and Net Worth do not add up with an overdrawn account (LED-172); the palette and the kind menu count loans differently (LED-156); Home's bills strip skips an overdue installment that Accounts lists (LED-173).
- **Cost that grows with the data:** each load step re-renders every mounted row (LED-164) and every route reads the whole history four or five times (LED-166).

## Decisions worth keeping
- **LED-149 item 9 (virtualisation):** needed, at least as memoisation (LED-125 retro has the numbers).
- **Sweep tickets are Done with FAIL rows,** because their acceptance criteria are "every item has a result and every FAIL has a ticket". The tickets they spawned are Done only when the sweep item passes again. This was not confirmed with the product owner; say so if a sweep should stay open until its FAILs are fixed.
- **A failure is never fixed inside a sweep.** Two were tempting (the sign-out copy, the account select) and stayed as tickets.
- **Sweep users only.** The real account and the two older validation users in the local database were left alone; `sweep-a`, `sweep-b`, `sweep-d`, `sweep-fresh` and `sweep-empty` were created and removed.

## Live checks
Local Supabase, headless Chrome over CDP at 1920x1080, 1280x900, 1024x768, 768x1024, 390x844 and 375x812, light by default with dark viewed where each retro says so (dark is a gap for several screens, listed in each Backlog), seeded over `psql`: 2,000 transactions on one account, three loan accounts (one legacy), a credit card, a PHP account, a receipt in storage, 33 categories with activity, a 160-row and a 3,000-row CSV. Performance was measured on the dev server and on `vite preview` of a production build. Errors were injected with `Fetch.fulfillRequest`, offline with `Network.emulateNetworkConditions`, a time zone with `Emulation.setTimezoneOverride`.

## Patterns added
`live-sweep-method.md`; `browser-check-with-local-user.md` extended (items 11 to 19: bisect with a stub, answer a write like the server, measure a list, compare with SQL, offline traps, files and time zones, dialog clicks, seed-data hygiene, the theme race).

## Backlog (not verified or deferred)
- No real iPhone, no Safari and no screen reader: LED-178 and LED-179.
- The sweep drivers and screenshots live in the session scratchpad and are not committed. Turning them into a repo script is not ticketed; say if you want it.
- The Category Select inside the import table at 375 could not be reached (LED-169 blocks it).
- The CSV statuses of LED-124 to 127 were set to Done; LED-149's row was not edited (its item 9 decision is recorded in the LED-125 retro and in LED-164).
- `.claude/launch.json` is still untracked.
