# Epic 6 — build order

Phases for `epic-6-per-screen-tasks.csv`. Refer to a phase as **"epic 6 phase N"**
(e.g. `/evaluate epic 6 phase 1`): evaluate every ticket in that phase, in the order listed,
and load each ticket's row from the CSV.

Based on `design_handoff_ledger_ui_audit/specs/tickets.md` → *Suggested build order*, with one
change: LED-99 was meant to ship with LED-60–62 (step 7), but they shipped in Epic 5 without it,
so Activity goes first.

- **Done before this plan:** LED-73 (shipped with Epic 5's import work).
- **Dependencies met:** LED-30, LED-04, LED-06, LED-20, LED-21, LED-33, LED-60.
- **Remaining:** 29 tickets, ~136 points.
- **Branch:** `epic-6-per-screen`. One commit per LED-NN ticket.

## Phase 1 — Activity (left over from step 7)

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 1 | LED-95 | Month change keeps the old data visible while the new month loads (High) | 5 | Pairs with LED-60; the windowed list already keeps its scroll position. |
| 2 | LED-99 | Activity detail pane | 5 | Pairs with LED-60–62; gives the detail pane its desktop home. |
| 3 | LED-79 | Transaction detail on phone and tablet | 5 | Same `EntryDetail` component; LED-80 depends on it. |
| 4 | LED-80 | Actions and content on the detail view | 5 | Adds the Split entry point. |
| 5 | LED-81 | Split dialog: remainder, rows, honest copy | 5 | Redone right after its new entry point. |

## Phase 2 — Reports (step 8), all in `ReportsPage.tsx`

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 6 | LED-70 | One set of controls, not two | 5 | Restructures the header, so it goes first. |
| 7 | LED-72 | Table and chart sizing | 5 | |
| 8 | LED-71 | Comparisons on every stat card | 2 | Small; sits on the new layout. |
| 9 | LED-94 | Loading placeholders shaped like the content | 5 | Three of its four sites are in `ReportsPage` (the fourth is the shared `Skeleton` radius); doing it later would conflict with LED-70 and LED-72. |

## Phase 3 — Import (step 8)

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 10 | LED-75 | Selectable rows, real preview, right account, right currency (High) | 8 | Changes the row structure. Check in `/evaluate` whether the transfer kind needs a migration. |
| 11 | LED-74 | Category suggestions | 5 | Adds an inline column to LED-75's rows. |

## Phase 4 — Accounts and Home (step 8)

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 12 | LED-76 | Accounts comparison layout and per-row context | 5 | Adds the Pay card and Repay loan actions that LED-83 reuses. |
| 13 | LED-98 | Account detail | 5 | |
| 14 | LED-85 | Account form: type grid, liability sign, period fields | 5 | |
| 15 | LED-77 | Flatten the credit-card monitor and fix its palette | 5 | |
| 16 | LED-78 | Home widget grid and order | 5 | |

## Phase 5 — Accessibility (step 9)

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 17 | LED-90 | `aria-current`, arrow-key tab navigation, skip link (High) | 5 | Touches only the nav components, so it can be pulled to the front if wanted. |
| 18 | LED-91 | Focus restore | 2 | |

## Phase 6 — Errors and notifications

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 19 | LED-93 | One notification surface and a recoverable error boundary | 5 | Build the surface first. |
| 20 | LED-92 | Plain-language error messages | 8 | Touches the ~20 hook sites once, straight onto LED-93's surface. The code-to-message mapping goes in `src/lib` with tests. |

## Phase 7 — Loans

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 21 | LED-82 | Unitemized-debt reconciliation warning | 5 | |
| 22 | LED-83 | Payment schedule you can scan and pay | 5 | Reuses the prefilled repayment form from LED-76. |
| 23 | LED-84 | Name the cost of borrowing | 5 | |

## Phase 8 — Budgets and Goals

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 24 | LED-86 | Segmented views and honest goals | 5 | |
| 25 | LED-87 | Budget form shows the real allowance | 2 | |

## Phase 9 — Remaining small pages

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 26 | LED-97 | 13th Month | 5 | |
| 27 | LED-96 | Login page says what the product is | 2 | |
| 28 | LED-88 | One `<LegalPage>` layout for three documents | 5 | |
| 29 | LED-89 | CSV export on the data-deletion page | 2 | Goes on LED-88's page and reuses the Reports exporter. |

## Things to watch

- **LED-80 and LED-93 both touch delete and undo.** LED-80 adds Delete to the detail view, and
  LED-93 replaces the undo toast it would use. Either keep LED-80's Delete on the current toast,
  or pull LED-93 forward before Phase 1.
- **LED-75's transfer kind** may need more than a type change. If transfers need linked rows,
  that means a migration, and it must apply cleanly to an empty database (CI `db` job).
- **Not in any Epic 6 ticket:** duplicate detection within a single CSV (LED-73 retro backlog).
  It needs a product decision first, since two identical rows can be two real purchases.
