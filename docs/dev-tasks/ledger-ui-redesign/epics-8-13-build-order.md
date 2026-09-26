# Epics 8 to 13 — build order

Phases for `epic-8-add-transaction-flow-tasks.csv`, `epic-9-semantic-colour-tasks.csv`,
`epic-10-disabled-states-tasks.csv`, `epic-11-docs-and-verification-tasks.csv`,
`epic-12-data-followups-tasks.csv` and `epic-13-design-parity-tasks.csv`.
Refer to a phase as **"epics 8-13 phase N"** (e.g. `/evaluate epics 8-13 phase 3`): evaluate every
ticket in that phase, in the order listed, and load each ticket's row from its CSV.

## Where these epics come from

Epics 0 to 7 (LED-01 to LED-103) are built and merged (`main` at `98d03ef`). On 2026-09-25 the shipped
work was audited against `design_handoff_ledger_ui_audit/` (README, `AGENTS.md`, `specs/`, the `.dc.html`
designs), the ticket CSVs and every retro. Lint, build and all 378 tests were green. The audit found
three kinds of gap, and each became an epic:

1. **Spec sections that never became tickets, and one regression created by a later ticket.**
   Epic 8 (add-transaction spec), Epic 9 (gold now renders indigo) and Epic 10 (opacity used for disabled).
   None of these was recorded in any retro.
2. **Gaps the retros did record and left open.** Epic 12 (data and write paths) and Epic 13 (design parity).
3. **Bookkeeping and never-verified work.** Epic 11 (stale statuses, missing retros, and a live-browser
   sweep, because 73 retro Backlogs say "not verified live").

- **Tickets:** 50 (LED-104 to LED-153). **Points:** 256.
- **Branch convention:** one branch per phase, `epics-8-13-phase-N`, one commit per LED-NN ticket, as before.
- **Nothing here is unshipped redesign scope that was ever approved.** Rows that need a product answer are
  `Blocked` on a decision (OD-1 to OD-6 below) and carry a **Fallback:** sentence describing what happens today.

## Phase 1 — Correctness fixes (independent, ship first)

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 1 | LED-104 | Loan repayment never auto-picks a loan (High) | 2 | Data-integrity bug from README Part 1 #3, still live at `TransactionForm.tsx:272-275`. No dependencies. |
| 2 | LED-129 | Partial-failure paths: account adjustment, undo, sign-out | 5 | A write that half-succeeds reports total failure. Uses the LED-93 notification surface already built. |
| 3 | LED-132 | Page the remaining transaction reads | 5 | Totals are wrong past 1,000 rows on any unpaged read. Follows `rules/page-reads-past-1000-rows.md`. |
| 4 | LED-135 | Home and Reports net worth follow Accounts' currency exclusion | 2 | Three screens show three net worths with a second-currency account. |
| 5 | LED-133 | Server-side monthly interest rate cap (migration) | 2 | Small migration; proves the CI `db` job before the larger migrations in Phase 8. |

## Phase 2 — Documentation reconcile (no application code)

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 6 | LED-121 | Reconcile CSV statuses and epic rows | 2 | `/evaluate` trusts the status column; 34 shipped tickets read To Do. Do it before anyone plans from it. |
| 7 | LED-122 | Correct ticket text and design captions the retros flagged | 2 | Removes wrong ticket text (including the 4c keypad caption and `tickets.md` LED-91). |
| 8 | LED-123 | Write the missing LED-06 and LED-09 retros | 2 | Completes the retro index. |

## Phase 3 — Semantic colour

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 9 | LED-115 | Gold token trio and `GOLD` repoint | 5 | Every later gold use depends on the token. **Must ship before LED-108 (Phase 6).** |
| 10 | LED-116 | Pending, liability and loan sites back to gold | 5 | Repoints the eight sites that render indigo since LED-100. Adds the guard test. |
| 11 | LED-117 | Budget bars: gold warning, income below the threshold | 2 | One `budgetTone` helper for three call sites. |
| 12 | LED-118 | Contrast leftovers: Home legend, 13th Month dash, uncategorized grey, treemap labels | 5 | Independent of the gold work; grouped because it is the same rendered-scan method. |

## Phase 4 — Disabled states

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 13 | LED-119 | Solid disabled tokens in the ui primitives | 8 | Changes `Button` (graphify degree 43), so it is isolated in its own phase and checked in both themes. |
| 14 | LED-120 | Disabled and off states outside the primitives, plus a guard test | 5 | Fixes the remaining sites and adds `tests/disabledStates.test.mjs` so the rule holds. |

## Phase 5 — Loan repayment form (5b)

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 15 | LED-105 | Loan picker step | 5 | Builds on LED-104's rule. Needs one batched read of purchases and allocations. |
| 16 | LED-106 | Repayment summary band and amount presets | 5 | Reuses the LED-24 card stats band markup. |
| 17 | LED-107 | Allocation preview before saving | 8 | Must match `allocate_loan_payment`; read `rules/loan-payment-date-decides-its-split.md` first. |

## Phase 6 — Kind menu (5a)

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 18 | LED-108 | Kind menu: Liabilities group, live descriptions, gold loan tile | 5 | Builds the shared `kindMenuItems` list. Needs LED-115. |
| 19 | LED-109 | Kind menu as a bottom sheet below md | 5 | Consumes LED-108's list so the two surfaces cannot drift. |
| 20 | LED-110 | E / I / T key caps on the kind menu | 2 | Closes the LED-40 deviation; the palette reads the same mapping. |

## Phase 7 — Kind asked once (4c) and card payment layout (12a)

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 21 | LED-111 | New-transaction dialog states its kind, with Change kind | 5 | Uses the menu's descriptions and reopens the menu. |
| 22 | LED-112 | Edit mode Kind selector that clears fields that no longer apply | 5 | Independent of create mode, but touches the same form, so it follows LED-111 to avoid conflicts. |
| 23 | LED-113 | Card payment 12a layout at three sizes | 8 | Shares the LED-111 header; closes the LED-24 PARTIAL. |

## Phase 8 — Offline and atomic writes (migrations)

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 24 | LED-128 | Offline queue: drain race, delete conflicts, failed inserts, expiry, singleton | 8 | Data-loss class. Adds the missing mock harness. |
| 25 | LED-130 | Split a transaction atomically (migration) | 8 | Needs LED-129's partial-failure handling first. |
| 26 | LED-131 | Unitemised loan debt: add it as a purchase, atomically (migration) | 8 | Same RPC pattern as LED-130. |

## Phase 9 — Design parity: Activity, Search, Budgets, Reports, Categories

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 27 | LED-137 | Search palette parity | 5 | Uses the LED-110 key mapping. |
| 28 | LED-139 | Budgets 4b: summary tiles, Copy last cycle, Needs attention, table | 8 | Uses LED-115 and LED-117. |
| 29 | LED-140 | Reports: Over budget stat card, phone label, breadcrumb, export follows Columns | 5 | LED-143 reuses the exporter. |
| 30 | LED-141 | 13th Month 15a: coverage strip and PD 851 checklist | 5 | Uses the gold token. |
| 31 | LED-152 | Categories desktop screen (8a) and remaining width caps | 8 | Estimate raised from 5 after reading 8a. Uses the LED-118 contrast fixes. |

## Phase 10 — Design parity: Home, Accounts, Import, Login, Legal

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 32 | LED-146 | One card-payment path and one prefilled loan-payment path | 5 | Needs the LED-113 card form. |
| 33 | LED-145 | Home: Pay now on the bills strip, phone fold, queued marker | 5 | Pay now opens the LED-146 path. |
| 34 | LED-147 | Import leftovers: ambiguous dates, no-category cause, same-payee apply | 5 | Independent. |
| 35 | LED-144 | Login: Google button ground, one logo, install prompt, dark panel, label | 5 | Needs LED-119 for the disabled styling. |
| 36 | LED-143 | Deletion export completeness | 5 | Reuses the LED-140 exporter. |

## Phase 11 — Accessibility, density, skeletons, theme

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 37 | LED-148 | Accessibility leftovers: focus ring, live region, detail pane, dialogs | 5 | Includes a screen-reader pass. |
| 38 | LED-149 | Density leftovers: Home pie, minus sign, sign rules, FAB overlap, export match | 5 | Item 9 (true virtualisation) waits for LED-125's measurement, so it may close as "not needed". |
| 39 | LED-150 | Skeletons for the remaining sites (25a) | 5 | Independent. |
| 40 | LED-151 | Theme leftovers: System option, custom accent contrast, one swatch set, ease-out note | 5 | Uses the LED-115 tokens. |

## Phase 12 — Live verification (run last, on the finished tree)

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 41 | LED-124 | Live sweep: shell, navigation, search and system states | 5 | Method: `patterns/browser-check-with-local-user.md`. |
| 42 | LED-125 | Live sweep: lists, reports and import | 5 | Needs a 2,000-row seed; also decides LED-149 item 9. |
| 43 | LED-126 | Live sweep: accounts, home, loans, budgets, legal and login | 8 | Includes the light-theme capture LED-77 never had. |
| 44 | LED-127 | Live sweep: every transaction kind on the mobile sheet | 5 | Verifies Epic 8 end to end at 390x844. |

A sweep records PASS, FAIL or "not checkable, reason" for every item. A FAIL becomes a new ticket; it is not fixed inside the sweep.

## Phase 13 — Decision-gated (decided 2026-09-26)

All six decisions were answered on 2026-09-26. Build order: 134, 142, 114, 138, 136 (LED-136 last: it changes totals on four screens).

| # | Ticket | Summary | Pts | Decision |
|---|---|---|---|---|
| 45 | LED-114 | Card payments are not spending: shared predicate, regression test, hide the Category control (no migration) | 2 | OD-2 (b) |
| 46 | LED-134 | Widget-order default for new profiles (migration) | 2 | OD-1 (b) |
| 47 | LED-136 | Live exchange-rate feed with a user-set refresh frequency, prefill and original amount (migration) | 8 | OD-3 (b) |
| 48 | LED-138 | Saved filters (migration) | 8 | OD-4 (a) |
| 49 | LED-142 | Data-deletion copy 24a and reading time | 2 | OD-5 (a) |
| 50 | LED-153 | Restore QuickEntry conveniences: closed, Won't Do | 0 | OD-6 (c) |

Phase totals in points: 1 = 16, 2 = 6, 3 = 17, 4 = 13, 5 = 18, 6 = 12, 7 = 18, 8 = 24, 9 = 31, 10 = 25, 11 = 20, 12 = 23, 13 = 22 (was 33 before the decisions: LED-114 8 to 2, LED-153 5 to 0). Sum 245.

## Decision register

Each row is a question only the product owner can answer. Until it is answered the ticket stays `Blocked` and its **Fallback:** sentence describes the behaviour that ships today.

| ID | Question | Options | Recommendation | Blocks |
|---|---|---|---|---|
| OD-1 | Change `profiles.dashboard_widget_order`'s default, and backfill? | (a) new default only; (b) new default plus update rows still equal to the old default; (c) leave as is | (b): backfill only rows that exactly equal the old default, so customised orders are untouched | LED-134 |
| OD-2 | How do card payments stop counting as spending? | (a) seed a "Card payments" category and filter on it, as 12a draws; (b) derive it from the target account type (`inferTransactionKind` already does) and filter on that, with no category or data migration | (b) is simpler and needs no backfill, but departs from the 12a category line. This needs your call | LED-114 |
| OD-3 | Where do exchange rates come from? | (a) manual entry per currency pair; (b) a fetched feed; (c) a rate stored on each transaction | (a) first: no external dependency, and the `exchange_rates` table already exists | LED-136 |
| OD-4 | Where do saved filters live? | (a) a `saved_filters` table with RLS, works across devices; (b) local storage, per browser | (a) | LED-138 |
| OD-5 | Who signs off the legal copy rewrite? | A named reviewer, or accept the developer's wording | You, before any edit (the text is legal text) | LED-142 |
| OD-6 | Restore the QuickEntry conveniences the keypad sheet had? | (a) all three (last-used account, frequent-category chips, fallback description); (b) last-used account only; (c) none | (b) | LED-153 |

### Answers (2026-09-26)

| ID | Answer | Effect |
|---|---|---|
| OD-1 | (b) | LED-134 sets the new default and updates only rows that exactly equal the old default. |
| OD-2 | (b) | No category and no migration. Card payments are already transfers (LED-146) and every spending predicate filters `type = 'expense'`, so LED-114 shrinks to a shared predicate, a regression test and hiding the Category control on the card form. |
| OD-3 | (b), with a user-set refresh frequency | Rates come from a live feed into the existing `exchange_rates` row. The user picks how often they refresh (every open, daily, weekly, manual). Overrides win over fetched rates. |
| OD-4 | (a) | `saved_filters` table with RLS. |
| OD-5 | (a) | The product owner approves the wording before it is committed. |
| OD-6 | (c) | None restored. LED-153 is closed as Won't Do. |

## Parked (no ticket yet)

Items the retros recorded that need a product answer or a design that does not exist. They are listed so they are not lost. Turn one into a ticket when its question is answered.

| Item | Source | Why parked |
|---|---|---|
| Unique category and subcategory names | LED-92 retro | `categories` and `subcategories` have no unique constraint, so a 23505 in practice only comes from `loan_payment_allocations`. Preventing duplicate names needs a decision and a migration. |
| Duplicate rows within one CSV | LED-73 retro | Two identical rows can be two real purchases. |
| Goal "on track / behind by" | LED-86 retro | Needs a contribution history that does not exist. |
| "Counts as salary" category flag | LED-97 retro | Salary matching is by category name only; a per-user flag is a product decision. |
| Like-for-like previous-period comparison | LED-71 retro | The current partial cycle is compared with the whole previous one, as 9a draws. |
| Future-dated transactions in the current cycle | LED-21 retro | The cycle runs to its end, so future-dated rows are counted. Needs a rule. |
| Deficit panel for a reset user with rollover off | LED-87 retro | If D1 is meant to apply without rollover, `useBudgets` changes, not the form. |
| Merge categories and the single Reorder control | 8a items 5 and 6 | Merge rewrites transactions; needs a decision. Left out of LED-152. |
| Amount sort in Activity | LED-61 retro | Cannot coexist with day groups; would force the flat view. |
| Shorter retry for foreground reads | LED-92 retro | About 8 s wait before a connection failure shows (supabase-js GET retries). |
| Per-widget error boundaries on Home; "Report a problem" wording | LED-93 decisions (a), (c) | Confirm with design. |

## Things to watch

- **LED-115 before LED-108.** The Loan repayment tile uses `--gold`, which does not exist until LED-115.
- **LED-119 changes `Button`.** graphify shows `button.tsx` at degree 43. Check every dialog footer, Home, Accounts, Budgets and Login in both themes before merging.
- **`TransactionForm.tsx` is a god node (degree 35).** LED-104, 105, 106, 107, 111, 112 and 113 all edit it. Merge in phase order and keep each diff to its own concern.
- **LED-107's preview must take the form's date.** `allocate_loan_payment` splits by what is due on the transaction date. A preview computed for "today" will disagree with what is saved.
- **Migrations (LED-114, 130, 131, 133, 134, 136, 138)** must apply cleanly to an empty database and pass the CI `db` job. Never run `pnpm db:push:remote`.
- **LED-130 and LED-131 change balances.** Confirm on a local database that the account-balance triggers net to zero (split) and to the gap (unitemised purchase) before merging.
- **LED-128 and useNetworkStatus.** The hook attaches its own listeners and the online handler drains. Do not add a second call site while it is not a singleton (LED-53 retro).
- **LED-120's guard test needs an allow-list.** `calendar.tsx` uses `opacity-50` for out-of-month day text, which is not a disabled state.
- **Live sweeps use a local Supabase test user.** Google OAuth blocks the agent. A real iOS device is needed for the decimal keypad and safe-area checks; list those as "not checkable" if none is available.
- **LED-121 is a status edit, not a redo.** Do not flip a ticket to Done unless a merged commit and a retro without a FAIL exist.

## Finding to ticket map

| Audit finding (2026-09-25) | Where recorded | Ticket |
|---|---|---|
| Loan repayment auto-picks the first loan (Part 1 #3) | Not in any retro | LED-104 |
| No loan picker, summary band, presets, allocation preview | Not in any retro | LED-105, 106, 107 |
| Kind menu unchanged (Liabilities group, live text, sheet, key caps) | LED-40 retro (key caps only) | LED-108, 109, 110 |
| Kind asked twice, no Change kind, no Kind selector on edit (Part 1 #17) | Not in any retro | LED-111, 112 |
| Card payment 12a layout partial; no Card payments category | LED-24 retro | LED-113, LED-114 |
| `GOLD` aliases `--primary`, which LED-100 made indigo | Not in any retro | LED-115, 116, 117 |
| Contrast leftovers (legend, dash, `#888`, treemap labels) | LED-100, LED-63 retros | LED-118 |
| Opacity used for disabled states | Not in any retro | LED-119, 120 |
| 34 CSV statuses stale; LED-06 and LED-09 without retros; wrong ticket text | LED-02, 03, 60, 103 retros | LED-121, 122, 123 |
| "Not verified live" across Epics 0 to 7 | 73 retro Backlogs | LED-124, 125, 126, 127 |
| Offline queue races and blind spots | LED-05, LED-53 retros | LED-128 |
| Half-succeeding writes; undo drops fields | LED-93, LED-11 retros | LED-129 |
| Split is not atomic and drops tags and receipt | LED-81, LED-93 retros | LED-130 |
| Unitemised debt cannot be itemised in one step | LED-82 retro | LED-131 |
| Unpaged reads remain | LED-101, LED-102 retros | LED-132 |
| Rate cap only in the client | LED-07 retro | LED-133 |
| Widget-order default defeats LED-78 | LED-78 retro | LED-134 (OD-1) |
| Net worth mixes currencies on Home and Reports | LED-76, LED-71 retros | LED-135 |
| No exchange-rate source | LED-75, LED-76 retros | LED-136 (OD-3) |
| Search palette parity gaps; saved filters | LED-40, 42, 64 retros | LED-137, LED-138 (OD-4) |
| Budgets 4b, Reports 9a, 13th Month 15a gaps | LED-86, 87, 23, 70, 22, 72, 97 retros | LED-139, 140, 141 |
| Legal copy 24a; deletion export incomplete | LED-88, LED-89 retros | LED-142 (OD-5), LED-143 |
| Login: Google button ground, logos, install prompt (Part 1 #18, #30, #31) | LED-96 retro (partly) | LED-144 |
| Home Pay now, phone fold, queued marker | LED-78, LED-53 retros | LED-145 |
| Two card-payment paths; unprefilled sidebar payment | LED-98, LED-83 retros | LED-146 |
| Import leftovers | LED-65, 74, 75 retros | LED-147 |
| Accessibility leftovers | LED-90, 91, 93, 63, 64 retros | LED-148 |
| Density leftovers | LED-60, 61, 62, 63 retros | LED-149 |
| Skeletons remain flat on five sites | LED-94, LED-95 retros | LED-150 |
| Theme leftovers | LED-32, 100, 56 retros | LED-151 |
| Categories has no desktop screen; width caps remain | LED-33, LED-31 retros; design 8a | LED-152 |
| QuickEntry conveniences lost with the keypad | LED-103 retro | LED-153 (OD-6) |

## Phase 12 outcome

The four live sweeps (LED-124 to LED-127) ran on 2026-09-26 and recorded 121 PASS, 24 FAIL and 10 not checkable. The FAILs and the backlog that needs prioritising are epic 14: `epic-14-live-sweep-findings-tasks.csv` and `epic-14-build-order.md` (28 tickets, LED-154 to LED-181).
