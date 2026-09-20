# Ticket breakdown — Ledger UI & navigation redesign (`redesign-v1`)

Cut from `docs/ui-audit-spec.md` and `docs/add-transaction-spec.md`. Design reference: `Ledger - 2B Screens.dc.html` (section ids in brackets), `Ledger - 2B Activity.dc.html` (3a).

All five open product decisions are resolved (see below). Every ticket carries a **feature impact** label, because the redesign does not only add — it also changes behaviour users have learned, constrains some things deliberately, and deletes others.

| Label | Meaning |
|---|---|
| **ADD** | Capability that does not exist today |
| **MOD** | Same capability, different behaviour, layout or wording |
| **LIMIT** | Deliberately constrained — a ceiling, a disabled state, or a narrower range than today |
| **REMOVE** | Capability or UI deleted outright |
| **FIX** | Defect in shipped behaviour; no intended change |

Sizes: **S** ≤ half a day · **M** 1–2 days · **L** 3–5 days · **XL** more than a week, split further before starting.

---

## Read this first — feature impact register

### Removed outright

| What goes | Where | Ticket | User-visible? |
|---|---|---|---|
| Seven Reports date presets (`useReportPresets`) | `ReportsPage.tsx` | LED-21 | Yes, but mitigated — the three ranges worth keeping (*Last 30 days*, *Last 90 days*, *Year to date*) return as the trend-chart lookback (LED-21a). The page-level date range is gone. |
| 13th Month as a Reports tab | `ReportsPage.tsx` `TabsContent` | LED-22 | Yes — same content, now reached by link. Keep `/thirteenth-month` working. |
| 240px desktop rail + 80px tablet icon rail | `Sidebar.tsx` | LED-30 | Yes — the main navigation moves from left edge to top. |
| Mobile *More* sheet as the home of dark mode and Categories | `BottomNav.tsx` | LED-31 | Yes — both move to places they can actually be found. |
| `max-w-5xl` / `max-w-3xl` page caps | Accounts, Reports, 13th Month | LED-33 | Yes — pages fill the window. |
| 176px dead scroll space + scroll-away FAB | mobile layout | LED-34 | Yes — improvement, no comms needed. |
| Duplicate Reports control trees (`hidden md:flex` pair + `md:hidden` Select) | `ReportsPage.tsx` | LED-70 | No — same state, one tree. |
| `EditAccountForm` + its second `accountSchema` | `AccountTransactionsPage.tsx` | LED-04 | No — one form for create and edit. |
| Atmospheric layer (gradient, dot grid, two bleed circles) | `DataDeletionPage.tsx` | LED-88 | Yes, cosmetic. |
| Four hand-rolled `animate-pulse` blocks | `ReportsPage.tsx` | LED-93 | No. |
| Nine copies of `text-sm text-destructive px-1 -mt-2` | Budgets, Account detail, Categories | LED-84 | No. |
| Eight hand-rolled muted-`<p>` empty states | Dashboard ×4, Budgets, Reports ×2, 13th Month | LED-50 | Yes — they gain actions. |
| `DEADLINES_PAGE_SIZE = 4` pagination | `LoanPurchaseTracker.tsx` | LED-78 | Yes — becomes a scrolling list. |
| Pie chart above 12 categories | `ReportsPage.tsx` | LED-63 | Yes — ranked bars instead. Pie stays under 12. |

### Deliberately limited

| Constraint | Why | Ticket |
|---|---|---|
| Rollover toggle **disabled** when `period !== 'monthly'` | It has never worked on non-monthly budgets; today it silently persists `true`. | LED-02 |
| Carried deficit **clamped at zero**, remainder reported | $900 against $600 otherwise opens the next cycle at −$300 — unmeetable. The uncarried remainder is not discarded: it appears in the Overspending report. **Decided.** | LED-20, LED-23 |
| Reports trend charts are **rangeable only on the chart**, not page-wide | Consequence of D3: a single cycle leaves one bar, so charts need their own lookback — but the range never drives the stat cards, table or breakdown. | LED-21, LED-21a |
| Activity / Account detail render a **window** (60 desktop, 30 mobile) | ~2,000 rows per account. Full-set rendering is the current behaviour and does not hold. | LED-60 |
| `monthly_interest_rate` gains a **maximum** | `125` for `1.25` is accepted today and produces a 31× installment. | LED-07 |
| Import **errors block** the import; warnings don't | Unparseable dates and non-numeric amounts cannot be written. | LED-65 |
| Detected duplicates default to **skip** (unticked) | Re-importing an overlapping statement should not silently double rows; the user opts in per row. | LED-65, LED-73 |
| Offline: features that can't work offline are **disabled up front** | Loan purchases hard-refuse after the form is filled today; four entities silently no-op. | LED-53 |
| Stagger capped at **four steps** (was eight, reaching 480ms) | Perceived as lag. | LED-82 |
| Search cycle scope defaults to **current cycle**, explicit toggle | Must not silently honour or ignore `useMonthCycle`. | LED-40 |

### Added

New capability, roughly in dependency order: budget deficit behaviour setting (LED-20) · Overspending report (LED-23) · card-payment kind and flow (LED-24) · global search palette (LED-40) · `EmptyState` action slot (LED-50) · empty vs filtered-empty split (LED-51) · first-run checklist (LED-52) · offline conflict review + *Sync now* (LED-05, LED-53) · list windowing (LED-60) · sticky result bar (LED-61) · month-jump rail (LED-62) · ranked-bar and treemap category views (LED-63) · grouped/counted search results (LED-64) · import duplicate detection, category suggestions, row selection, problems-by-cause (LED-65, LED-73–75) · transaction detail on mobile (LED-76) · loan interest disclosure and schedule preview (LED-80) · loan reconciliation banner and pay-from-tracker (LED-77, LED-79) · goal monthly-contribution figure (LED-86) · `<LegalPage>` layout and CSV export (LED-88, LED-89) · skip link, `aria-current`, roving tabindex (LED-81) · one notification surface (LED-83) · dark theme in the header (LED-32).

### Decisions — all resolved (2026-09-17)

Nothing is blocked. Implement to these.

| # | Decision | Ticket |
|---|---|---|
| 1 | **Carried deficit clamps at zero**, and the uncarried remainder is shown in the Overspending report — so a budget never opens negative and the overspend is still on the record. | LED-20, LED-23 |
| 2 | **Existing users keep `'carry'` on upgrade.** New users default to `'reset'`. Nobody's figures change under them. | LED-20 |
| 3 | **Reports presets: clean break**, removed in the same release as the shell. No deprecation period, no instrumentation, no release note — the user base is a handful of people and speed wins. The three ranges worth keeping come back scoped to the trend charts. | LED-21, LED-21a |
| 4 | **Import duplicates default to skip** — flagged and unticked; the user opts in per row. | LED-65, LED-73 |
| 5 | **First-run checklist is advisory.** Lock glyphs mark destinations that cannot work yet; everything stays reachable. | LED-52 |

**Risk on decision 3, closed.** Usage is unmeasured and will stay that way: the user base is a handful of people and the removal is worth more than the certainty. No instrumentation, no deprecation release, no release note. What made it safe to skip all three is that the presets split cleanly in two — *This month* / *Last month* / *Custom range* are single-cycle questions the stepper answers better, and *Last 30 days* / *Last 90 days* / *Year to date* are trend questions that come back as the chart lookback in **LED-21a**. Nothing a user could ask with the presets becomes unanswerable.

---

## Epic 0 — Data integrity and correctness (no design dependency)

Ship before or alongside the shell. LED-01 and LED-05 are data-integrity issues.

### LED-01 · Budget rollover compounds overspend — **FIX** · S
`useBudgets.ts` · [23a] · spec §1.1
`if (b.rollover_enabled) rolloverAmount += surplus` — `surplus` is negative in an overspent period, so the deficit is carried and subtracted from the next limit, compounding across the window.
**Accept:** behaviour is driven by `budget_deficit_behaviour` (LED-20); under `'reset'`, `rolloverAmount += Math.max(0, surplus)`; under `'carry'`, the carried figure is floored so the effective limit is never below zero; a budget overspent three cycles running shows the correct limit in cycle four under both settings, and an overspend larger than the whole budget opens the next cycle at zero, not negative.
**Depends on:** LED-20 (schema).

### LED-02 · Rollover toggle does nothing on non-monthly budgets — **FIX / LIMIT** · S
`useBudgets.ts`, `BudgetForm`, `BudgetsPage.tsx:1115` · [23a] · spec §1.2
The rollover block is inside `if (b.period === 'monthly')`, but the form renders the checkbox, persists `rollover_enabled: true`, and the card renders a **Rollover** chip for every period.
**Accept:** toggle disabled with an inline reason when `period !== 'monthly'`; chip not rendered for a budget whose period can't roll over; existing non-monthly budgets with `rollover_enabled: true` are not silently mutated.

### LED-03 · Budgets ignore unrated-currency spend — **FIX** · S
`useBudgets.ts` · [23a] · spec §1.7
`convertAmount` returns `null` with no rate and the reducer skips the transaction, so the budget reads **under** budget. Accounts and Reports both warn; Budgets doesn't.
**Accept:** the budget shows the same excluded-currency warning pattern the other two screens use, naming the currency.

### LED-04 · One account schema, one form — **FIX / REMOVE** · M
`AccountsPage.tsx`, `AccountTransactionsPage.tsx` → new `src/components/accounts/AccountForm.tsx` · [19a] · spec §1.4
Two schemas have drifted: the edit schema lacks `loan_pay_period`, `loan_due_days`, `loan_due_weekday`, so a loan's repayment schedule can never be edited after creation.
**Accept:** one `AccountForm` + one `accountSchema` serves create and edit; a loan's schedule is editable; `EditAccountForm` and the duplicate schema are deleted.
**Blocks:** LED-85.

### LED-05 · Sync conflicts and expiries stop being silent — **FIX / ADD** · L
`offlineQueue.ts`, `useNetworkStatus`, `OfflineBanner` · [22a] · spec §1.3
`drainQueue` skips a conflicted write with a `console.warn`; items past `MAX_QUEUE_AGE_MS` (30 days) are deleted with another. The user saw the edit apply locally.
**Accept:** `QueueItem` gains `status: 'conflict' | 'expired'`; conflicted and expired items are retained, not dropped; the count is exposed from `useNetworkStatus` alongside `pendingCount`; `OfflineBanner` shows a failure state linking to the queue-review sheet where the user picks *keep mine* / *keep theirs*.

### LED-06 · Encoding errors on 13th Month — **FIX** · S
`ThirteenthMonthPage.tsx` · [15a] · spec §1.5
An en dash written in a non-UTF-8 encoding renders as `�` in the page subtitle, the card title and the transaction meta separator. The first is in the page's opening sentence.
**Accept:** all three render an en dash; file is UTF-8; the "Records Included" card no longer uses `EXPENSE` colour for a neutral count.

### LED-07 · Loan rate and installment guards — **FIX / LIMIT** · S
`LoanPurchaseForm.tsx` · [14a] · spec §1.7
`monthly_interest_rate` is `min(0)` with no maximum — `125` for `1.25` is accepted. `installmentEdited` latches `true` on the first keystroke and never resets, permanently disconnecting the field from `calculateFlatMonthlyInstallment`.
**Accept:** a sane maximum with a clear message; a recalculate affordance restores the computed installment.

### LED-08 · `inferTransactionKind` mis-types card payments — **FIX** · S
`transactionKinds.ts` · [12a] · add-transaction-spec §1.3
`type === 'expense' && toAccountId` cannot distinguish a credit-card target from a loan target, so already-saved card payments read as loan repayments.
**Accept:** resolved by the target account's `type`; existing rows re-infer correctly with no migration.
**Blocks:** LED-24.

### LED-09 · Cash-flow forecast renders the word "Recur" — **FIX** · S
`DashboardCashFlowForecastCard.tsx` · [18a] · spec §1.7
`item.tx.category?.icon ?? 'Recur'` puts the literal string in an icon-sized slot.
**Accept:** a real fallback icon.

### LED-10 · `/terms` has no `routeMeta` — **FIX** · S
`App.tsx` · spec §1.7 — falls through to the generic page title while `/privacy` and `/data-deletion` have entries.

### LED-11 · Auth failures reach the console only — **FIX** · S
`AuthContext.tsx:40, :55, :87` · [26a] · spec §5.13.4
Profile fetch, `getSession` and sign-out failures are `console.error` only. A silent sign-out failure leaves the user believing they signed out.
**Accept:** all three surface to the user; sign-out failure is explicit.

### LED-12 · Failed reads no longer render as empty states — **FIX** · M
`useTransactions.ts:87`, `useAccounts.ts:38`, `useCategories.ts:36`, `useSavingsGoals.ts:40`, `useLoanPurchases.ts:53` and their consuming pages · [26a] · spec §5.13.1
Each hook sets an `error` string the page never reads, so a connection failure shows "No transactions found" and offers "Add transaction".
**Accept:** every list page consumes `error` before `isEmpty`; a forced network failure shows a retryable error, not an empty state.
**Pairs with:** LED-51.

---

## Epic 1 — Decisions D1–D4

### LED-20 · `budget_deficit_behaviour` setting — **ADD** · M
Schema + Settings → Budgets · [7a, 28a] · spec D1
`'carry' | 'reset'`. Default `'reset'` for new users, **`'carry'` on upgrade for existing users** so nobody's figures change under them. Global, not per-budget — do not build both.
**Accept:** two radios (not a toggle), each showing the figure it produces; copy is **"When you overspend"** → *Reduce next cycle's budget* / *Start the next cycle fresh*; the word "rollover" is not used for the deficit; the existing per-budget surplus toggle is untouched and independent.
**Decided:** under `'carry'` the carried deficit **clamps at zero** — a budget never opens negative — and the uncarried remainder is reported in Overspending (LED-23), not discarded. Existing users keep `'carry'` on upgrade; new users get `'reset'`.
**Blocks:** LED-01, LED-23, LED-87.

### LED-21 · Reports follows the global cycle; presets removed — **MOD / REMOVE / LIMIT** · L
`ReportsPage.tsx`, `useReportPresets` (deleted), `useMonthCycle` · [9a, 28a] · spec D3, §2.3
Clean break — removed in the same release as the shell, no deprecation period.
**Accept:** the seven presets and `useReportPresets` are gone; Reports reads `useMonthCycle` and shows the row-2 stepper like every other screen; stat cards, transaction table and category breakdown follow the selected cycle; **trend charts get their own lookback, labelled on the chart and never driving the rest of the page** (LED-21a sets its options).
**Depends on:** LED-30 (row-2 stepper).

### LED-21a · Trend-chart lookback — **ADD** · S
`ReportsPage.tsx` · **[30a]**, amending [9a, 28a]
The lookback D3 requires anyway becomes a small selector rather than a hardcoded 12 months, which is what keeps the three presets worth having. Drawn at desktop and mobile, all four states.
**Accept:** options are **Last 30 days · Last 90 days · Year to date · Last 12 months**, defaulting to 12 months; the selection sits on the chart card — never the header — and the chart subtitle names both its range and its bucket size; **bucket size adapts**: 30 days daily, 90 days weekly, YTD and 12 months monthly (the old presets kept monthly bars at every range, so *Last 30 days* rendered as a single bar); the selection **never** affects the stat cards, transaction table or category breakdown, which stay on the stepper's cycle.
**Scope boundary:** do not persist the lookback beyond the session, do not surface it in the header, and do not let the stat cards read it — any of the three turns it back into the page-level date range D3 removed.
**Depends on:** LED-21.

### LED-22 · 13th Month becomes a route, not a tab — **MOD / REMOVE** · S
`ReportsPage.tsx`, `/thirteenth-month` · [15a] · spec D2
It has its own year selector and period semantics, so nesting it inside Reports' date controls was always wrong.
**Accept:** `ThirteenthMonthPage` is out of `TabsContent`; Reports' tab row is two tabs (Overview, Analytics) and links to the route; `/thirteenth-month` is unchanged for anyone with the URL.

### LED-23 · Overspending section in Reports — **ADD** · M
`ReportsPage.tsx` · [28a] · spec D1b
**Accept:** per cycle, per category, amount over budget, and a count of consecutive cycles over; populated regardless of the setting — under `'carry'` it explains why the next cycle is lower, under `'reset'` it is the only record; **under `'carry'` with a clamped deficit, the uncarried remainder is shown as its own figure** (the part of the overspend the next cycle did not absorb), so clamping never hides anything; derived from existing data (budget amount vs category spend per cycle), no new write path.
**Depends on:** LED-20.

### LED-24 · Card payment flow — **ADD** · L
new `'card-payment'` kind · [12a] · add-transaction-spec §1.3, spec D4
**Accept:** the kind exists end to end per the add-transaction spec; 12a is built at all three sizes; a card payment saved before LED-08 re-infers correctly.
**Depends on:** LED-08.

---

## Epic 2 — Navigation shell (2B)

LED-30 unblocks every per-screen layout ticket. Do not start Epic 6 before it lands.

### LED-30 · Two-row top bar replaces the rails — **MOD / REMOVE** · XL
`AppLayout`, `Sidebar.tsx` (deleted), new header components · [2B sections] · spec §2.1
Row 1: wordmark, seven destination tabs, search (`⌘K`), theme toggle, settings, avatar. Row 2: page title or breadcrumb, period stepper, page controls, primary action. Below tablet: row 1 collapses to title + search + avatar, tabs scroll in their own row, bottom nav takes over.
**Accept:** all seven destinations are tabs at desktop and tablet — **including `/categories`, which has no desktop or tablet nav entry today**; the period stepper is one control owned by the shell, replacing the four that render it now; the 240px and 80px rails are deleted; the shell is interactive from the first frame and never shows a skeleton (LED-95).
**Split before starting** — suggested: shell + row 1 / row 2 controls + stepper ownership / responsive collapse + bottom nav.
**Blocks:** LED-21, LED-33, LED-40, Epic 6.

### LED-31 · Categories and dark mode leave the More sheet — **MOD / REMOVE** · S
`BottomNav.tsx` · spec §2.2
Categories is reachable only from the mobile *More* sheet today; dark mode exists only there.
**Accept:** Categories is a destination at every size; the theme toggle is in row 1 at all sizes and in Settings.
**Depends on:** LED-30.

### LED-32 · Theme toggle in the header — **ADD / MOD** · S
Row 1 + Settings · spec §2.2 — see LED-100 for the token pairing.

### LED-33 · Drop the page width caps — **REMOVE / MOD** · M
Accounts, Reports, 13th Month · spec §2.2.4
`max-w-5xl` / `max-w-3xl` waste ~900px at 1920.
**Accept:** caps removed; each page uses explicit column grids at the freed width; no line of body copy exceeds a readable measure.
**Depends on:** LED-30. **Blocks:** LED-70, LED-71.

### LED-34 · Reclaim the mobile FAB space — **REMOVE / MOD** · S
mobile layout · spec §2.2.5 — 176px of dead scroll space is reserved under the FAB, and the FAB scrolls out of reach.
**Accept:** the reserved space is gone; the primary action stays reachable at any scroll position.

---

## Epic 3 — Global search (16a)

Cheapest large win in the audit: `cmdk` is installed, `ui/command.tsx` is ~190 lines with a working `CommandDialog`, and its only consumer is `AccountCombobox`. The palette already ships to every user and does nothing — and the `⌘K` affordance in the 2B header implies it works.

### LED-40 · Search palette v1 — **ADD / LIMIT** · L
`ui/command.tsx`, new search hook · [16a] · spec Part 3
**Accept:** searches descriptions, payees, account names, category names; **numeric queries match amounts** — exact first, then a ±5% band; results grouped Transactions / Accounts / Categories / Actions; Actions reuse the `E` / `I` / `T` keys from the kind menu so the palette is a faster Add Transaction than the button; **cycle scope is an explicit toggle defaulting to the current cycle** — never silently honouring or ignoring `useMonthCycle`.
**Depends on:** LED-30.

### LED-41 · Search empty state — **ADD** · S
[16a] · spec Part 3
**Accept:** before typing: four record actions, anything due soon from `getLoanDeadlines` / `daysUntilDayOfMonth`, and jump-to for all seven destinations — including Categories and Import CSV, the two hardest things to reach today.

### LED-42 · Mobile search is a full-screen view — **ADD** · M
Pushed from the header search icon, not a centred palette. [16a]

---

## Epic 4 — Shared components

LED-50 and LED-51 are the smallest changes touching the most screens — ship them early.

### LED-50 · `EmptyState` action slot, then adopt it — **ADD / REMOVE** · M
`ui/empty-state.tsx` + 8 call sites · [20a] · spec §4.1
The component takes exactly `icon`, `title`, `description`, so Accounts renders *"Add your first account to get started"* with no button to do it. Add optional `action?: ReactNode` — ~3 lines, fixes every use at once.
**Accept:** action slot added; adopted in the eight places that hand-roll a muted `<p>`: `DashboardRecentTransactionsCard`, `DashboardDetailDialogs` (×3), `BudgetsPage`, `ReportsPage` (×2), `ThirteenthMonthPage`.

### LED-51 · Empty ≠ filtered-empty — **ADD / MOD** · M
`TransactionsPage.tsx:573`, `AccountTransactionsPage.tsx:953`, Reports, 13th Month · [20a] · spec §4.2
Both render `title="No transactions found"` whether the user has zero transactions ever or eighteen excluded by a filter. These need opposite responses.
**Accept:** no records → "Nothing recorded yet" + Add transaction · Import CSV. Filter excluded everything → "No income in Sep 1 – Sep 30" + the true total + Show all N · try adjacent cycle. Same split on Reports' "No transactions in this period" and 13th Month's "No income transactions found for 2026".
**Pairs with:** LED-12 — error, empty and filtered-empty are three states, not one.

### LED-52 · First-run checklist — **ADD** · M
Home · [20a] · spec §4.3
**Accept:** three ordered steps matching the real dependency chain — add an account → record or import a transaction → set the pay cycle; skippable; persists until complete; destinations that cannot work yet (Activity, Budgets, Categories, Reports) carry a **lock glyph** in the nav — **not** `opacity`, which reads as broken.
Advisory only — the checklist never blocks; lock glyphs are a signal, not a gate.

### LED-53 · Offline states say what's true — **MOD / ADD / LIMIT** · L
`OfflineBanner`, `useNetworkStatus` · [22a] · spec §4.4
**Accept:** when `isOnline && !isSyncing && pendingCount > 0` the banner no longer says *"reconnecting…"* — it offers **Sync now**, calling the `syncNow` the banner never calls today; progress reads `Syncing 2 of 3` rather than a bare spinner; queued rows are marked, consuming the `queued: true` flag `addTransaction` already returns and nobody reads; the three unsignalled offline behaviours are made explicit — transactions and month cycle queue and replay, loan purchases refuse **before** the form is filled, and accounts/budgets/categories/savings goals stop silently returning early; gold for pending, red only for genuine failure, and the banner's 11px tracking-wide type comes up to the app's smallest body size.
**Depends on:** LED-05.

### LED-54 · One row component for clickable rows — **FIX / MOD** · M
`DashboardCategoryPieCard:29`, `BudgetsPage:1090`, `TransactionsPage:481`, `TransactionRow:177`, `DashboardTransactionRow:23` · [27a] · spec §5.12.3
Four rows set `tabIndex={0}` with no `onKeyDown`; only the fifth handles Enter/Space, hand-rolled.
**Accept:** one button-based row component fixes all five; every focusable row is operable by keyboard.

### LED-55 · `<FormError>` — **REMOVE / MOD** · S
`BudgetsPage` (4), `AccountTransactionsPage` (3), `CategoriesPage` (2) · [26a] · spec §5.13.8
Nine copies of `text-sm text-destructive px-1 -mt-2`. One component removes all nine.
**Accept:** single component; `role="alert"` on every inline error — it appears in one file today (`LoanPurchaseTracker`, 4 uses) while ~20 others are unannounced.

### LED-56 · Motion tokens — **MOD** · M
`src/index.css` · [27a] · spec §5.12.4–6, .10
The motion layer is the best-built part of the branch; these are gaps, not a rewrite.
**Accept:** six duration tokens replace eleven ad-hoc values (`--dur-instant` 100, `--dur-fast` 160, `--dur-base` 200, `--dur-enter` 280, `--dur-sheet` 260, `--dur-meter` 500 — the last two are deliberate, keep them); `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)` is a variable so Tailwind transitions stop falling back to `ease`; the two `@media (prefers-reduced-motion)` blocks are merged and cover what they currently miss — `animate-pulse`, `animate-spin` (5 sites), `animate-in`/`animate-out`/`zoom-*`/`slide-in-from-*` (dialog, sheet, dropdown, popover, tooltip, select) and ~40 `transition-colors`; stagger caps at four steps; one ring width (primitives use `ring-3`, hand-rolled rows `ring-2`).

---

## Epic 5 — Density at real volume

Sized to the answered ceilings: **~2,000 transactions per account, 4–8 accounts, 20–50 categories.** Drawn in [29a], spec §7.

**Do LED-60 and LED-61 with the Activity rebuild, not after it** — retrofitting virtualisation into a finished list costs more than building it in.

### LED-60 · Window the transaction lists — **ADD / LIMIT** · L
`TransactionsPage.tsx`, `AccountTransactionsPage.tsx` · [29a] · spec §7 V1
Both render the full filtered set today.
**Accept:** a rendered window — 60 rows desktop, 30 mobile — loading on scroll; sticky date group headers carrying per-day item count and net; scroll position survives a cycle change (LED-94); 2,000 rows on one account stays responsive.

### LED-61 · Sticky result bar — **ADD** · M
Activity, Account detail · [29a] · spec §7 V2
**Accept:** match count, count of total on the account, active range and the sum of the match, pinned above the rows and persisting while scrolling; sort and density controls live in the same bar.
**Depends on:** LED-60.

### LED-62 · Month jump — **ADD** · M
Activity, Account detail · [29a] · spec §7 V3
24 months of history is 24 stepper clicks.
**Accept:** a right-hand rail (desktop) / bottom-bar action (mobile) listing months with their net and jumping straight to any of them; the period stepper stays for single-step moves.

### LED-63 · Reports: no pie above 12 categories — **MOD / REMOVE / ADD** · L
`ReportsPage.tsx` · [29a] · spec §7 V4
At 20–50 categories a pie is unreadable and its legend is taller than the chart.
**Accept:** above 12 categories, ranked horizontal bars with the top 8 shown and the remainder in one expandable "Other · N categories" row carrying its own share; Grouped and Treemap views added; pie retained below 12.
**Depends on:** LED-21.

### LED-64 · Search: group, cap, count — **MOD / ADD** · M
[29a] · spec §7 V5
A common term matches hundreds of rows.
**Accept:** results grouped by kind, each group capped at 3, the true count stated per group and overall, and "See all in Activity" handing off; footer keyboard hints including ⌘F to scope to the current account.
**Depends on:** LED-40.

### LED-65 · Import: group problems by cause — **ADD / LIMIT** · L
`ImportCSVDialog.tsx` · [29a] · spec §7 V6
37 problems in 1,284 rows is five causes, not 37 rows to fix.
**Accept:** error / warning / duplicate counts as a summary strip; a problems-by-cause panel where fixing a cause (e.g. date format D/M/Y) clears every row under it; **errors block the import, warnings don't**; problem rows sort first; an "Only problems" filter.
**Duplicates default to skip** — flagged and unticked, with the matched existing row named so the user can opt in per row.
**Depends on:** LED-73.

### LED-66 · Not affected — no ticket
Budgets & Goals and Split transaction stay inside their current layouts at these volumes. Revisit only if the ceilings move.

---

## Epic 6 — Per-screen. All depend on LED-30.

Ordered by value. Reports, Accounts and Home gain most from the freed width — do those three first.

### Reports [9a] — `ReportsPage.tsx` (~57k, the largest UI file)

- **LED-70 · One set of controls, not two — REMOVE / MOD · M.** Range and presets are built twice: a `hidden md:flex` card pair and a separate `md:hidden` Select + button, same state, two trees. Also fold the two full-width control cards (Date Range, Saved Presets) into the header row — ~240px of vertical chrome before a single figure. Depends on LED-21, LED-33.
- **LED-71 · Comparisons on every stat card — ADD · S.** `$3,812.65` with nothing to judge it against isn't reporting; `monthlyData` already holds the previous month, so `↑ 11.8% vs Aug` is one subtraction.
- **LED-72 · Table and chart sizing — MOD · M.** Charts are `h-52` at every viewport — let them fill their row and abbreviate y-axis ticks (`8k`) instead of `formatCurrency` in a 72px gutter. The table hides Category below `sm`, Account below `md`, Balance below `lg` — and `max-w-5xl` means Balance is hidden at 1024 even in a 1920 window: show all seven columns with a Columns control. Selected preset chips use `background: GOLD`, the only place in the app where gold means "selected" rather than loans — retire with LED-21.

### Import CSV [10a] — `ImportCSVDialog.tsx`

- **LED-73 · Duplicate detection — ADD · M.** Re-import the same statement, or one overlapping last month by three days, and you get silent duplicates with no way to tell them apart. Match on date + amount + normalised description before the write; a match defaults to **skip** (unticked) and names the row it matched. Blocks LED-65.
- **LED-74 · Category suggestions — ADD · M.** `category_id: null` is hardcoded for every row and the dialog apologises for it twice. A payee→category memory from past transactions gets most rows right; the rest show `Choose…` inline.
- **LED-75 · Selectable rows, real preview, right account, right currency — ADD / MOD / FIX · L.** `parsed.rows` maps straight to the insert, so one bad row means cancel, edit the CSV, re-drop. `max-w-2xl` + `PREVIEW_ROW_COUNT = 8` means the user approves 142 transactions having seen six percent of them. `setAccountId(accounts[0].id)` auto-picks whatever account is first. Preview formats with `selectedAccount?.currency ?? 'PHP'`, so a PHP statement imported into a USD account renders **and imports** as dollars, unconverted and unwarned. `ImportTx` allows only `income | expense`, so a transfer between own accounts imports twice and inflates both totals.

### Accounts list [6a] — `AccountsPage.tsx`

- **LED-76 · Comparison layout and per-row context — MOD / ADD · M.** Assets and Liabilities side by side — that's the comparison the page is about. A share bar per asset row (concentration is mental arithmetic today). **Move the excluded-currency warning onto the row**: today one amber line under the summary names the currencies, so you can't tell which account was dropped from the total. Due dates collect into a "Coming up" cell instead of `Due in Nd` chips scattered across liability cards. Liability cards get real actions (Pay card / Repay loan) — each card is only a navigation button today. Loan progress gets a meter; cards get a utilisation bar but loans get only a schedule string. Depends on LED-33.

### Home [18a]

- **LED-77 · Flatten the credit-card monitor and fix its palette — MOD · M.** `DashboardCreditCardMonitor` nests boxes four deep (card → bordered inner card → four `border-border/40` rows → up to two reminder strips) at `lg:col-span-2`. **Its reminder strips are the only place on Home that leaves the app palette** — raw `amber-500`/`amber-700` and `sky-500`/`sky-700` where everything else uses `INCOME` / `EXPENSE` / `GOLD` from `constants/colors`, and gold already means "liability due". Utilisation colour is binary (`nearLimit ? EXPENSE : INCOME`), so 0% and 69% render identically green then snap to red.
- **LED-78 · Widget grid and order — MOD · M.** Upcoming Bills is first in `DEFAULT_WIDGET_ORDER` (correct) but spends a whole grid cell on two rows of text — make it a strip. Three columns at 1920 fit the eight default widgets without scrolling; mobile shows the first four above the fold, user order respected.

### Transaction detail [13b] — `EntryDetail.tsx` (55 lines)

- **LED-79 · Detail below `lg` — ADD · M.** Renders only at `lg:` today; below that, tapping a row opens the **edit form**, so on a phone there is no way to *look* at a transaction without entering edit mode on it.
- **LED-80 · Actions and content — ADD / MOD · M.** One action (`onEdit`) today: delete is behind a row swipe, and Split has no entry point from the transaction you'd split. Transfers list Account and To account as two unrelated `<dl>` rows — render as from → to. Add budget impact (this entry's share of the category bar), tags and receipt — all three are form fields absent from the detail view. `transaction.date` prints raw as `2026-09-09`.

### Split transaction [13a] — `SplitTransactionDialog.tsx`

- **LED-81 · Remainder, rows, and honest copy — ADD / MOD · M.** `addLine` already seeds the new line with `diff`, but only if the user thinks to press Add line — surface it: "$9.40 unassigned → Add as a line". Lines are stacked ~130px cards in a `max-w-xl` dialog, so three splits need scrolling; use rows. **"$X over budget" is the wrong phrase** — this is over-allocation of one transaction and has nothing to do with Budgets. Splitting **deletes the original and writes N new rows, irreversibly**, and the dialog never says so. Disabled Split has three causes (unbalanced / blank description / zero amount) and one silent state.

### Loans [21a, 14a]

- **LED-82 · Unitemized-debt reconciliation, permanently — ADD · M.** The warning renders only when `purchases.length === 0`, inside the create modal — shown once, then never again. But `getLoanAmountOwed(account)` and the sum of purchases can drift apart at any time, and the gap is debt with no schedule and no deadline. Put it on the tracker whenever they disagree.
- **LED-83 · Schedule you can scan and pay — MOD / ADD / REMOVE · M.** `DEADLINES_PAGE_SIZE = 4` with prev/next and every row collapsed by default (`expandedDeadline` starts `null`) is the wrong interaction for a schedule you want to scan: scrolling list, next payment pinned and expanded. The tracker computes the next deadline and its per-purchase split and offers no way to pay it — launch the loan-repayment form prefilled. `opening_installments_paid` renders an identical progress bar to money actually repaid — two segments. Recent Payment Splits drops the installment number, which is the thing that identifies the payment.
- **LED-84 · Name the cost of borrowing — ADD / MOD · M.** `totalPayable` is shown; interest (`totalPayable − principal`) never is — at 1.25% flat over 24 months that's **$720 on $2,400, 30% over sticker**. Term is on step 1 and rate on step 2, the two inputs that jointly decide cost split across a page break. "Flat interest" is a 12px muted line, and flat vs reducing-balance roughly doubles the effective rate. Preview the schedule (first date, last date, and the true final installment — it's a balancing figure and can differ). "Already Paid" takes a count while the adjacent summary shows a currency amount, both unlabelled. Show the effect on the parent loan: outstanding after, and the new monthly obligation.

### Account form [19a]

- **LED-85 · Type grid, liability sign, period fields — MOD / ADD · M.** Type becomes a visible 8-cell grid (all eight types have icons in `ACCOUNT_ICONS`) since the choice changes which fields appear. **Explain the liability sign where it's entered** — `normalizeLiabilityBalanceForStorage` flips it: the user types a positive "I owe this", and getting it backwards silently inverts net worth. Preview day numbers (`statement_day: 16` + `due_day: 1` means 16 days to pay, which is the useful fact). **Show which control each loan period summons** — `superRefine` has four branches (*twice a month* needs two `loan_due_days`, *weekly* needs `loan_due_weekday` 0–6 as a separate field, *daily* needs neither, everything else needs one day) across seven periods in `LOAN_PAY_PERIOD_LABELS`, all discovered on submit today. Compute available credit live (`credit_limit + balance`). Mark the `.nullable()` fields optional and say what's lost by skipping them (countdowns, utilisation bar). Depends on LED-04.

### Budgets & Goals [4b, 23a]

- **LED-86 · Segmented views and honest goals — MOD / ADD · M.** Split Budgets and Goals into segmented views — the header period applies to budgets, not goals. Over-budget rows cap the bar at 100% and carry the true percentage in the number. Name the cycle in the budget form: budgets run on `getBudgetCycleRange`, not the calendar month, and the form never shows the resulting dates. Goals derive the monthly contribution needed from target + saved + date — the number that makes a goal actionable. **Say goals are manual**: no account link, `current_amount` is hand-edited, and transferring to Emergency Fund doesn't move the goal.
- **LED-87 · Budget form shows the real allowance — ADD · S.** Surface the already-computed `rollover_amount` as **base limit → carried in → effective**, and which deficit behaviour is active. The effective allowance otherwise silently differs from the number the user typed. Depends on LED-20. [23a, 28a]

### Legal pages [24a]

- **LED-88 · One `<LegalPage>`, three documents — MOD / REMOVE · M.** All three rebuild the same skeleton (back links, icon, title, last-updated, sections, separators, footer) in their own file. **Delete the atmospheric layer** from `DataDeletionPage`: four absolutely-positioned decorative elements — a 700×500 radial gradient, a 3%-opacity dot grid and two ~500px bordered circles bleeding off-canvas — rendered before any content. Red (`--expense`) currently colours both section headings, all four step numbers and the summary box; reserve it for step 04 and the no-grace-period warning. Cross-link all three — today only Data deletion links to Privacy.
- **LED-89 · CSV export beside the deletion instructions — ADD · S.** Reports already has the exporter.

### Accessibility and focus [27a]

- **LED-90 · `aria-current`, roving tabindex, skip link — ADD · M.** **`aria-current` has zero occurrences in the codebase** — `Sidebar.tsx` and `BottomNav.tsx` mark the active destination by background tint alone. Blocking for 2B, which puts seven tabs where the rail was. Seven tabs must also be **one tab stop**: roving `tabIndex` (active `0`, others `-1`, arrows move) + `role="tablist"`, or 2B costs six extra stops before content on every screen. Add one `<a href="#main">` skip link, visible on focus — nine stops to content at 1920 under 2B.
- **LED-91 · Focus restore — MOD · S.** On open, focus the heading, not the first field; on close, return to the trigger. Matters most for 5a → form and 5b picker → form.

### Error and loading states [26a, 25a]

- **LED-92 · Human error copy — MOD · L.** ~20 sites surface `error.message` verbatim: `useAccounts` (:38, :90, :105, :124, :162), `useLoanPurchases` (:53, :71, :100, :125, :139), `useExchangeRates` (:116, :154, :204), `useBudgets` (:59, :88), `useCategories` (:36, :106), `useSubcategories`:106, `useTransactions`:87, `useSavingsGoals`:40, `SettingsPage`:274. Map the codes that actually occur — unique violation, RLS denial, connection failure — to sentences, and keep the raw text collapsed for support.
- **LED-93 · One notification surface + recoverable boundary — ADD / MOD · M.** `ui/undo-toast.tsx` is used only by `TransactionsPage` and `AccountTransactionsPage` for undo-delete. Add one surface with three severities: success + undo, failure + retry, partial failure + fix. `ui/error-boundary.tsx:32` renders "Something went wrong." with no retry — scope it to the failed section, state what is safe, offer recovery. `AccountTransactionsPage.tsx:536` is the only partial-failure instance and its copy is good — reuse its shape wherever a two-phase write can half-succeed. Off-system colours in `BudgetsPage.tsx:641` (`bg-yellow-500` / `bg-emerald-500` where `GOLD` / `INCOME` exist).
- **LED-94 · Skeletons that describe their target — MOD / REMOVE · M.** Replace `ReportsPage.tsx`'s four hand-rolled pulses (:948, :1186, :1236, :1285) with the `Skeleton` the same file already imports on :40 and uses correctly six other times. `Skeleton` hard-codes `rounded-md` while call sites override with `rounded-xl`, `rounded-2xl`, `rounded-[20px]`, `rounded-lg` and `rounded` — cards are 20px, so decide whether the default matches the card radius or every call site passes one. Then make skeletons structural: keep the row grid, icon tile and dividers real and grey only the text runs, which also removes the load-time layout shift. State the spinner rule — spinner for a user-triggered action (`ImportCSVDialog`, `TransactionForm`), skeleton for content arriving.
- **LED-95 · First load ≠ refetch — MOD · M.** Stepping the month cycle swaps content for skeletons despite data being on screen. Keep the previous cycle visible at reduced opacity with a progress rule and a named target, preserving scroll position. And **the shell never loads** — nav, period stepper, title and primary action depend on no query and should be interactive from the first frame. Pairs with LED-30, LED-60.

### Remaining screens [8a, 7a, 4a, 3a, 11a, 15a]

- **LED-96 · Login says what the product is — MOD · S.** The page never says what Ledger does: a stranger sees a wordmark, a five-word tagline and a Google button. `max-w-100` centres a phone-width column on a 1920 display. `error_description` prints raw — *"server_error: unable to exchange external code"*.
- **LED-97 · 13th Month — MOD · M.** Beyond LED-06: the estimate is printed three times on one page; months start collapsed so the include/exclude checkbox sits on a closed row; add "auto-select salary only", since category is already on every record.
- **LED-98 · Account detail — MOD · M.** Breadcrumb instead of the back-chevron; balance / limit / statement / due in one band so the right pane can carry payment + category breakdown. [4a]
- **LED-99 · Activity — MOD · M.** The freed width finally gives the entry-detail pane a home without squeezing the list. [3a] Pairs with LED-60–62.

---

## Epic 7 — Dark theme

### LED-100 · Dark token pairs — **ADD** · M
`src/index.css` · spec §8
`index.css` already ships complete token pairs; the design doc is the reference for the pairing. Notable values: surfaces page `#131218`, frame `#1E1D23`, header `#22212A`, card `#26252E`, divider `#38363F`, border `#4C4A55`; ink `#E6E4EA` / `#C3C1CA` / `#A9A7B1`; primary `#A8B4DE` on container `#333C5C` with **on-primary text `#1B2135` — dark ink on the lightened accent, not white**; success `#A6D9B0`/`#22362A`, error `#F2B8AE`/`#4A2621`, warning `#E8CE92`/`#3C3320`; category hues step one tint lighter (`#F97316` → `#FB923C`, `#3B82F6` → `#60A5FA`) so swatches hold against dark surfaces.
**Accept:** every screen renders in dark with no hardcoded light value surviving; the toggle in LED-32 switches it; contrast holds at 4.5:1 for body text.

---

## Suggested build order

1. **Epic 0** — data integrity first (LED-01, LED-05), then the rest in any order.
2. **LED-50, LED-51** — smallest change touching the most screens; do them while Epic 0 is in review.
3. **LED-20 → LED-01, LED-23, LED-87** — the decision chain.
4. **LED-30** (split into four) — unblocks everything in Epic 6.
5. **LED-21a** — small, and it's what makes the preset removal a non-event; do it with LED-21, not later.
6. **LED-40–42** — the `⌘K` affordance ships with the shell, so it shouldn't stay dead long.
7. **LED-60–62 with LED-99** — window the list as you rebuild it, not after.
8. **LED-70–78** — Reports, Import, Accounts, Home: the screens that gain most from the freed width.
9. **LED-90, LED-91, LED-56** — accessibility and motion, once the shell's structure is settled.
10. Everything else per-screen; **LED-100** any time after LED-32.
