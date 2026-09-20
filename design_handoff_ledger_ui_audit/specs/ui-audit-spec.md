# Implementation spec — UI & navigation audit, redesign-v1

Design source: `Ledger - 2B Screens.dc.html` (sections 4a–23a) and `Ledger - 2B Activity.dc.html` (3a).
Branch: `redesign-v1`. Companion to `docs/add-transaction-spec.md`, which covers the add-transaction kind menu (5a), loan repayment (5b) and card payment (12a) — **not repeated here**.

Every claim below was read from source. File and symbol names are exact. Section ids in brackets point at the mockup.

---

## Decisions (resolved 2026-09-17)

**Design for D1, D1b and D3 is drawn in section 28a** of `Ledger - 2B Screens.dc.html`. D2 and D4 need no new drawing — 12a already covers card payment at all three sizes.

Four decisions were previously blocking. All are settled — implement to these.

### D1 — Budget deficit becomes user-controlled

Carrying the deficit (current behaviour) was judged punishing. Add a setting so the user chooses, and surface overspending either way.

Schema: `budget_deficit_behaviour` — `'carry' | 'reset'`. Default `'reset'` for new users; **`'carry'` for existing users on upgrade**, so nobody's figures change under them.

- **Global setting** in Settings → Budgets, not per-budget. A per-budget override can layer on later; do not build both now.
- `'carry'` — today's behaviour. $742 against a $600 budget leaves next cycle at $458.
- `'reset'` — next cycle opens at the full $600. **The overspend is not discarded** — see D1b.
- The existing per-budget "Rollover unused budget" toggle keeps its meaning: whether a *surplus* carries. The two are independent, and carry-surplus + reset-deficit is the new default combination.
- Copy: avoid "rollover" for the deficit. Use **"When you overspend"** with *Reduce next cycle's budget* / *Start the next cycle fresh*.
- Render as **two radios, not a toggle** — a toggle needs one label that reads correctly in both states, and "Carry overspend: off" is a double negative on a financial setting. Each option shows the figure it produces.
- **Resolved:** under `'carry'` the carried deficit **clamps at zero** — a budget never opens negative — and the uncarried remainder (the part the next cycle did not absorb) is shown in the Overspending report, so clamping hides nothing. $900 against $600 opens the next cycle at $0 with $300 reported as uncarried.

### D1b — Overspending is reported, not lost

Under `'reset'` the deficit must stay visible or the setting becomes a way to hide bad news.

- Reports gains an **Overspending** section: per cycle, per category, amount over, and a count of consecutive cycles over.
- Populated regardless of the setting — under `'carry'` it explains why next cycle is lower; under `'reset'` it is the only record.
- Under `'carry'` with a clamped deficit, the **uncarried remainder** is a figure of its own in this section.
- Derivable from existing data (budget amount vs category spend per cycle). No new write path.

### D2 — 13th Month is a route, not a tab

Remove `ThirteenthMonthPage` from the `TabsContent` in `ReportsPage.tsx`; keep `/thirteenth-month`. It has its own year selector and period semantics, so nesting it inside Reports' date controls was always wrong. Reports' tab row drops to two tabs (Overview, Analytics) and links to the route.

### D3 — Reports follows the global monthly cycle

Remove the seven date presets (`useReportPresets`) — a clean break in the same release as the shell, no deprecation period; Reports uses `useMonthCycle` like every other screen, and 2B's row-2 stepper applies here too. **This supersedes §2.3 below.**

One consequence to handle deliberately — the Income vs Expenses trend chart cannot be scoped to one cycle without leaving a single bar. Split the two notions:

- **Stat cards, transaction table, category breakdown** follow the selected cycle.
- **Trend charts** keep an independent lookback from the selected cycle, labelled on the chart and not driven by the stepper. The lookback is **selectable — Last 30 days / Last 90 days / Year to date / Last 12 months, defaulting to 12 months** — which is where the three presets worth keeping survive. It is a chart control, not a page-level date range: it never affects the stat cards, transaction table or category breakdown. Bucket size adapts to the range — 30 days daily, 90 days weekly, YTD and 12 months monthly. **Drawn in section 30a.**

### D4 — Card payment ships

Build 12a and the `'card-payment'` kind per `add-transaction-spec.md` §1.3. The `inferTransactionKind` fix (§1.6) is required either way — it mis-types already-saved card payments today.

---

## Part 1 — Bugs to fix regardless of the redesign

These are defects in shipped behaviour. None of them depend on the navigation change; all can go in before it.

### 1.1 Budget rollover carries overspend forward and compounds it — `useBudgets.ts` [23a]

```ts
const surplus = b.amount - periodSpent
if (b.rollover_enabled) rolloverAmount += surplus
```

`surplus` is negative in any period the user overspent, so the deficit is carried into the next period and subtracted from that limit, accumulating across every month in the window. The checkbox is labelled **"Rollover unused budget"**, which describes only the positive case.

**Decided (D1): the user chooses.** Add `budget_deficit_behaviour`. Under `'reset'` clamp with `rolloverAmount += Math.max(0, surplus)`; under `'carry'` keep the current line. Then:
- *If carry-forward of debt is intended* — relabel to "Carry the difference into next period" and say in the helper text that overspend reduces next period's limit. Show the signed carried figure wherever the budget is displayed.
- *If only surplus should carry* — clamp: `rolloverAmount += Math.max(0, surplus)`.

Either way, surface `rollover_amount` (already computed) in the budget edit form as **base limit → carried in → effective**, since the effective allowance otherwise silently differs from the number the user typed.

### 1.2 Rollover silently does nothing on non-monthly budgets — `useBudgets.ts` [23a]

The whole rollover/history block is inside `if (b.period === 'monthly')`. For any other period `rollover_amount` stays `0` — but `BudgetForm` still renders the checkbox, still persists `rollover_enabled: true`, and the budget card still renders a **Rollover** chip (`BudgetsPage.tsx:1115`).

Fix: disable the toggle when `period !== 'monthly'` with the reason inline, and don't render the chip for a budget whose period can't roll over.

### 1.3 Sync conflicts discard user edits silently — `offlineQueue.ts` [22a]

`drainQueue` compares `updated_at`; when the row changed elsewhere since the mutation was queued it skips the write and calls:

```
console.warn(`[offlineQueue] Conflict detected for ${item.table}:${item.rowId} — skipping stale update`)
```

The user made the edit, saw it applied locally, and it is dropped with no notice. Same class of problem for `MAX_QUEUE_AGE_MS`: items older than 30 days are deleted on drain with another `console.warn`.

Fix:
- Keep conflicted and expired items in a distinct state rather than dropping them (e.g. `status: 'conflict' | 'expired'` on `QueueItem`).
- Expose the count from `useNetworkStatus` alongside `pendingCount`.
- Surface it in `OfflineBanner` as a failure state, linking to the queue-review sheet in 22a where the user picks *keep mine* / *keep theirs*.

### 1.4 Two account schemas; loan schedules can't be edited — `AccountsPage.tsx` / `AccountTransactionsPage.tsx` [19a]

`AccountForm` (in `AccountsPage.tsx`) creates accounts. A separate `EditAccountForm` with its own `accountSchema` (in `AccountTransactionsPage.tsx`) edits them. The edit schema carries `credit_limit`, `statement_day` and `due_day` but **not `loan_pay_period`, `loan_due_days` or `loan_due_weekday`** — so a loan created with a repayment schedule can never have it changed from the account page.

Fix: extract one `AccountForm` + one `accountSchema` to `src/components/accounts/AccountForm.tsx`, used for both create and edit. That closes the drift permanently rather than patching the missing fields.

### 1.5 Three encoding errors render on screen — `ThirteenthMonthPage.tsx` [15a]

An en dash was written in a non-UTF-8 encoding and renders as `�` in three places: the page subtitle (`Computed under PD 851 � Select which income records…`), the card title (`Income Records � 2026`), and the transaction meta separator. The first is in the opening sentence of the page.

Also on that page: the "Records Included" summary card is coloured with `EXPENSE` for a neutral count.

### 1.6 `inferTransactionKind` collapses card payments into loan repayments — `transactionKinds.ts` [12a]

Covered in `add-transaction-spec.md` §1.3; repeated here only because it is a correctness bug, not a design change. The check is `type === 'expense' && toAccountId`, which cannot distinguish a credit-card target from a loan target. Resolve by the target account's `type`.

### 1.7 Smaller correctness items

| Where | What |
|---|---|
| `LoanPurchaseForm.tsx` [14a] | `monthly_interest_rate` is validated `min(0)` with no maximum — `125` instead of `1.25` is accepted and silently produces a 31× installment. Add a sane cap. |
| `LoanPurchaseForm.tsx` [14a] | `installmentEdited` latches `true` on first keystroke and never resets, permanently disconnecting the installment field from `calculateFlatMonthlyInstallment`. Add a recalculate affordance. |
| `DashboardCashFlowForecastCard.tsx` [18a] | `item.tx.category?.icon ?? 'Recur'` renders the literal word "Recur" in an icon-sized slot. |
| `useBudgets.ts` [23a] | `convertAmount` returns `null` when no rate exists and the reducer skips that transaction, so a budget with unrated-currency spend reads **under** budget with no warning. Accounts and Reports both warn; Budgets doesn't. |
| `App.tsx` | `/terms` has no `routeMeta` entry while `/privacy` and `/data-deletion` do, so it falls through to the generic page title. |

---

## Part 2 — Navigation shell (2B)

The chosen model. Replaces the 240px desktop rail and the 80px tablet icon rail with a top bar; the mobile bottom nav is unchanged in structure.

### 2.1 Structure

Two header rows at every breakpoint ≥ tablet:

- **Row 1** — wordmark, seven destination tabs, search field (`⌘K`), theme toggle, settings, avatar.
- **Row 2** — page title (or breadcrumb), the period stepper, page-level controls, primary action.

Below tablet: row 1 collapses to title + search + avatar, tabs scroll horizontally in their own row, and the bottom nav takes over.

### 2.2 What this fixes

1. **`/categories` has no desktop or tablet nav entry today** — it is reachable only from the mobile *More* sheet. In 2B all seven destinations are tabs.
2. **The month cycle is rendered by four different controls** (`CycleStepper` on mobile, separate inline controls elsewhere). One stepper, in row 2, owned by the shell.
3. **Dark mode exists only inside the mobile More sheet.** Moves to row 1 at all sizes, and to Settings.
4. **`max-w-5xl` / `max-w-3xl` page caps** waste ~900px at 1920 on Accounts, Reports and 13th Month. Removed; content uses the full width with explicit column grids.
5. **The 176px of dead scroll space** reserved under the mobile FAB, and the FAB that scrolls out of reach.

### 2.3 Reports — superseded by D3

**Reports now follows the global monthly cycle and shows the row-2 stepper like every other screen.** The seven presets are removed. The earlier plan (suppress the stepper, keep the presets) is no longer the decision — see D3, including the trend-chart lookback it requires.

---

## Part 3 — Global search (16a)

**Cheapest large win in the audit.** `cmdk` is an installed dependency, `src/components/ui/command.tsx` is ~190 lines including a working `CommandDialog`, and the only consumer is `AccountCombobox` — an account picker. The palette already ships to every user's browser and does nothing, while the `⌘K` affordance in the 2B header implies it exists.

Scope for v1:
- Search descriptions, payees, account names, category names.
- **Numeric queries match amounts** — exact first, then a ±5% band.
- Results grouped: Transactions / Accounts / Categories / Actions.
- **Actions** reuse the `E` / `I` / `T` keys from the kind menu (add-transaction spec §1.4), so the palette is a faster Add Transaction than the button.
- **Cycle scope is an explicit toggle**, defaulting to the current cycle. Search must not silently honour or ignore `useMonthCycle`.
- Empty state (before typing): four record actions, anything due soon from `getLoanDeadlines` / `daysUntilDayOfMonth`, and jump-to for all seven destinations — including Categories and Import CSV, the two hardest things to reach today.
- Mobile: a full-screen view pushed from the header search icon, not a centred palette.

---

## Part 4 — Shared components

### 4.1 `EmptyState` needs an action slot — `ui/empty-state.tsx` [20a]

The component takes exactly `icon`, `title`, `description`. So Accounts renders *"Add your first account to get started"* with no button to do it. Add an optional `action?: ReactNode`; ~3 lines, fixes every use at once.

**Then adopt it in the eight places that hand-roll a muted `<p>` instead**: `DashboardRecentTransactionsCard`, `DashboardDetailDialogs` (×3), `BudgetsPage`, `ReportsPage` (×2), `ThirteenthMonthPage`.

### 4.2 Empty ≠ filtered-empty [20a]

`TransactionsPage.tsx:573` and `AccountTransactionsPage.tsx:953` both render `title="No transactions found"` whether the user has zero transactions ever or eighteen excluded by a filter. These need opposite responses:

| State | Message | Action |
|---|---|---|
| No records exist | "Nothing recorded yet" | Add transaction · Import CSV |
| Filter excluded everything | "No income in Sep 1 – Sep 30" + the true total | Show all N · try adjacent cycle |

Same split applies to Reports' "No transactions in this period" and 13th Month's "No income transactions found for 2026".

### 4.3 First-run checklist [20a]

No first-run experience exists. Three ordered steps on Home, matching the real dependency chain: **add an account → record or import a transaction → set the pay cycle**. Skippable and **advisory — it never blocks**; persists until complete. Destinations that cannot work yet (Activity, Budgets, Categories, Reports) are marked with a lock glyph in the nav — **not** faded with `opacity`, which reads as broken.

### 4.4 Offline states [22a]

`OfflineBanner` exists and is wired into `AppLayout` — the gaps are in what it says:

- When `isOnline && !isSyncing && pendingCount > 0` it reads *"N changes queued — reconnecting…"*. The user is already connected; the drain simply isn't running. `useNetworkStatus` exports `syncNow` and the banner never calls it — **add a Sync now button**.
- Show progress (`Syncing 2 of 3`) instead of a bare spinner; `drainQueue` processes in order and the total is known.
- Queued rows are indistinguishable from saved rows. `addTransaction` returns `{ error: null, queued: true }` and no caller renders the flag — mark the row.
- Three different offline behaviours with no signalling: transactions and month cycle queue and replay; loan purchases hard-refuse *after* the form is filled; accounts, budgets, categories and savings goals `return` early and neither save nor complain. Disable what can't work, up front.
- Banner styling: `var(--primary)` for syncing reads as a feature announcement, and 11px tracking-wide is below the app's smallest body size. Gold for pending, red only for genuine failure.

---

## Part 5 — Per-screen changes

Each entry: the mockup id, the files, and the changes worth making. Ordered by value.

### 5.1 Reports [9a] — `ReportsPage.tsx` (~57k, largest UI file)

**Also per D1b: add an Overspending section** — per cycle, per category, amount over budget, consecutive cycles over. And per D3: presets out, global cycle in, trend charts keep their own 12-month lookback.

1. **Every stat card gets a comparison.** `$3,812.65` with nothing to judge it against isn't reporting. `monthlyData` already holds the previous month — `↑ 11.8% vs Aug` is one subtraction.
2. Fold the two full-width control cards (Date Range, Saved Presets) into the header row — ~240px of vertical chrome before a single figure.
3. **One set of controls, not two.** Range and presets are built twice: a `hidden md:flex` card pair and a separate `md:hidden` Select + button. Same state, two trees.
4. Charts are `h-52` at every viewport. Let them fill their row; abbreviate y-axis ticks (`8k`) instead of `formatCurrency` in a 72px gutter.
5. The transaction table hides Category below `sm`, Account below `md`, Balance below `lg` — and `max-w-5xl` means Balance is hidden at 1024 even in a 1920 window. Show all seven columns, with a Columns control.
6. Selected preset chips use `background: GOLD` — the only place in the app where gold means "selected". Gold means loans everywhere else.

### 5.2 Accounts list [6a] — `AccountsPage.tsx`

1. Drop `max-w-5xl`; Assets and Liabilities side by side (that's the comparison the page is about).
2. Share bar per asset row — currently name/type/balance, so concentration requires mental arithmetic.
3. **Move the excluded-currency warning onto the row.** Today one amber line under the summary names the currencies, so you can't tell which account was dropped from the total.
4. Collect due dates into a "Coming up" cell; the `Due in Nd` chips are scattered across liability cards.
5. Liability cards get real actions (Pay card / Repay loan) — each card is only a navigation button today.
6. Loan progress gets a meter; cards get a utilisation bar but loans get only a schedule string.

### 5.3 Home [18a] — `useDashboardPrefs.ts`, `DashboardCreditCardMonitor.tsx`, `DashboardCashFlowForecastCard.tsx`

1. `DashboardCreditCardMonitor` nests boxes four deep (card → bordered inner card → four `border-border/40` rows → up to two reminder strips) at `lg:col-span-2`. Flatten.
2. **Its reminder strips are the only place on Home that leaves the app palette** — raw `amber-500`/`amber-700` and `sky-500`/`sky-700`, where everything else uses `INCOME` / `EXPENSE` / `GOLD` from `constants/colors`. Gold already means "liability due".
3. Upcoming Bills is first in `DEFAULT_WIDGET_ORDER` (correct) but spends a whole grid cell on two rows of text — make it a strip.
4. Utilisation colour is binary (`nearLimit ? EXPENSE : INCOME`), so 0% and 69% render identically green then snap to red.
5. Three columns at 1920; the eight default widgets fit without scrolling.
6. Mobile shows the first four widgets above the fold, user order respected.

### 5.4 Import CSV [10a] — `ImportCSVDialog.tsx`

1. **Duplicate detection.** Re-import the same statement, or one overlapping last month by three days, and you get silent duplicates with no way to tell them apart. Match on date + amount + normalised description before the write; **a match defaults to skip** (flagged, unticked, naming the row it matched) and the user opts in per row.
2. **Category suggestions.** `category_id: null` is hardcoded for every row and the dialog apologises for it twice. A payee→category memory from past transactions gets most rows right; the rest show `Choose…` inline.
3. Rows become selectable — today `parsed.rows` maps straight to the insert, so one bad row means cancel, edit the CSV, re-drop.
4. `max-w-2xl` + `PREVIEW_ROW_COUNT = 8` means the user approves 142 transactions having seen six percent of them.
5. `setAccountId(accounts[0].id)` auto-picks whatever account is first — same silent-wrong-target problem as the loan picker, at 142 rows.
6. Preview formats with `selectedAccount?.currency ?? 'PHP'`, so a PHP statement imported into a USD account renders and imports as dollars, unconverted, unwarned.
7. `ImportTx` allows only `income | expense`, so a transfer between own accounts imports twice and inflates both totals.

### 5.5 Transaction detail pane [13b] — `EntryDetail.tsx` (55 lines)

1. **Renders only at `lg:`.** Below that, tapping a row opens the edit form — so on a phone there is no way to *look* at a transaction without entering edit mode on it.
2. One action (`onEdit`). Delete is behind a row swipe; Split has no entry point from the transaction you'd split.
3. Transfers list Account and To account as two unrelated `<dl>` rows — render as from → to.
4. Add budget impact (this entry's share of the category bar), tags and receipt — all three are form fields absent from the detail view.
5. `transaction.date` is printed raw as `2026-09-09`.

### 5.6 Split transaction [13a] — `SplitTransactionDialog.tsx`

1. **Surface the remainder as one tap.** `addLine` already seeds the new line with `diff` — but only if the user thinks to press Add line. Show "$9.40 unassigned → Add as a line".
2. Lines are stacked cards (~130px each) in a `max-w-xl` dialog; three splits need scrolling. Use rows.
3. **"$X over budget" is the wrong phrase** — this is over-allocation of one transaction and has nothing to do with the Budgets screen.
4. Splitting deletes the original and writes N new rows, irreversibly, and the dialog never says so.
5. Disabled Split has three different causes (unbalanced / blank description / zero amount) and one silent state.

### 5.7 Loan purchase tracker [21a] — `LoanPurchaseTracker.tsx`

1. **The unitemized-debt reconciliation escapes the Add dialog.** That warning renders only when `purchases.length === 0`, inside the create modal — shown once, then never again. But `getLoanAmountOwed(account)` and the sum of purchases can drift apart at any time, and the gap is debt with no schedule and no deadline. Put it on the tracker, permanently, whenever they disagree.
2. `DEADLINES_PAGE_SIZE = 4` with prev/next and every row collapsed by default (`expandedDeadline` starts `null`) — wrong interaction for a schedule you want to scan. Scrolling list, next payment pinned and expanded.
3. The tracker computes the next deadline and its per-purchase split and offers no way to pay it. Launch the loan-repayment form prefilled.
4. `opening_installments_paid` renders an identical progress bar to money actually repaid — use two segments.
5. Recent Payment Splits drops the installment number, which is the thing that identifies the payment.

### 5.8 Loan purchase form [14a] — `LoanPurchaseForm.tsx`

1. **Name the cost of borrowing.** `totalPayable` is shown; interest (`totalPayable − principal`) never is. At 1.25% flat over 24 months that's $720 on $2,400 — 30% over sticker.
2. Term is on step 1 and rate on step 2 — the two inputs that jointly decide cost, split across a page break.
3. "Flat interest" is a 12px muted line; flat vs reducing-balance roughly doubles the effective rate.
4. Preview the schedule (first date, last date, true final installment — it's a balancing figure and can differ).
5. "Already Paid" takes a count while the adjacent summary shows a currency amount, both unlabelled.
6. Show the effect on the parent loan: outstanding after, and the new monthly obligation.

### 5.9 Account form [19a] — see §1.4 for the schema merge

1. Type becomes a visible 8-cell grid (all eight types have icons in `ACCOUNT_ICONS`) — the choice changes which fields appear.
2. **Explain the liability sign where it's entered.** `normalizeLiabilityBalanceForStorage` flips the sign: the user types a positive "I owe this". Getting it backwards silently inverts net worth.
3. Preview day numbers — `statement_day: 16` + `due_day: 1` means 16 days to pay, which is the useful fact.
4. **Show which control each loan period summons.** `superRefine` has four branches: *twice a month* needs two different `loan_due_days`; *weekly* needs `loan_due_weekday` (0–6, a separate field); *daily* needs neither; everything else needs one day. Seven periods in `LOAN_PAY_PERIOD_LABELS`. All discovered on submit today.
5. Compute available credit live (`credit_limit + balance`).
6. Mark the `.nullable()` fields optional and say what's lost by skipping them (countdowns, utilisation bar).

### 5.10 Budgets & Goals [4b] and their forms [23a]

1. Split Budgets and Goals into segmented views — the header period applies to budgets, not goals.
2. Over-budget rows cap the bar at 100% and carry the true percentage in the number.
3. Name the cycle in the budget form: budgets run on `getBudgetCycleRange`, not the calendar month, and the form never shows the resulting dates.
4. Goals: derive the monthly contribution needed from target + saved + date. That's the number that makes a goal actionable.
5. **Say goals are manual.** No account link; `current_amount` is hand-edited. Transferring to Emergency Fund doesn't move the goal.

### 5.11 Legal pages [24a] — `PrivacyPolicyPage.tsx`, `TermsOfServicePage.tsx`, `DataDeletionPage.tsx`

1. **One `<LegalPage>` layout, three documents.** All three rebuild the same skeleton — back links, icon, title, last-updated, sections, separators, footer — in their own file.
2. **Delete the atmospheric layer** from `DataDeletionPage`: four absolutely-positioned decorative elements (700×500 radial gradient, 3%-opacity dot grid, two ~500px bordered circles bleeding off-canvas) rendered before any content.
3. Red (`--expense`) currently colours both section headings, all four step numbers and the summary box. Reserve it for step 04 and the no-grace-period warning.
4. Cross-link the three pages; today only Data deletion links to Privacy.
5. Offer CSV export beside the deletion instructions — Reports already has the exporter.
6. `/terms` has no `routeMeta` entry (also §1.7).

### 5.12 Motion & focus order [27a] — `src/index.css`, nav components, clickable rows

The motion layer is the best-built part of the branch: four keyframes on one easing curve, stagger helpers, a reduced-motion block. These are gaps in it, not a rewrite.

1. **`aria-current` has zero occurrences.** `Sidebar.tsx` and `BottomNav.tsx` mark the active destination by background tint alone. Add `aria-current="page"`. Blocking for 2B, which puts seven tabs where the rail was.
2. **Seven tabs = one tab stop.** Roving `tabIndex` (active `0`, others `-1`, arrows move) + `role="tablist"`. Without it 2B costs six extra stops before content on every screen.
3. **Four rows focusable but not operable.** `DashboardCategoryPieCard`:29, `BudgetsPage`:1090, `TransactionsPage`:481, `TransactionRow`:177 set `tabIndex={0}` with no `onKeyDown`. Only `DashboardTransactionRow`:23 handles Enter/Space, hand-rolled. One button-based row component fixes all five.
4. **Reduced motion covers four class names only.** The block lists `.animate-page-in`, `.animate-fade-up`, `.animate-scale-in`, `.reorder-motion`. Still animating: `animate-pulse` (all skeletons), `animate-spin` (5 sites), `animate-in`/`animate-out`/`zoom-*`/`slide-in-from-*` (dialog, sheet, dropdown, popover, tooltip, select), ~40 `transition-colors`. Also merge the two separate `@media (prefers-reduced-motion)` blocks (one by the sheet rule, one at file end).
5. **Eleven durations, no token.** 100/140/150/160/180/200/260/280/320/420/500ms. Six tokens: `--dur-instant` 100, `--dur-fast` 160, `--dur-base` 200, `--dur-enter` 280, `--dur-sheet` 260, `--dur-meter` 500. The last two are deliberate — keep.
6. **Name the easing curve.** `cubic-bezier(0.22, 1, 0.36, 1)` is used consistently but is not a variable, so Tailwind transitions get `ease`. Add `--ease-out`.
7. **Two ring widths.** Primitives use `focus-visible:ring-3`; hand-rolled rows use `ring-2`.
8. **No skip link.** Nine stops to content at 1920 under 2B. One `<a href="#main">` visible on focus.
9. **Focus restore unspecified.** On open, focus the heading (not the first field); on close, return to the trigger. Matters most for 5a → form and 5b picker → form.
10. **Stagger reaches 480ms.** `.anim-delay-8` on a 420ms animation. Cap at four steps.

### 5.13 Error states [26a] — hooks, `ui/error-boundary.tsx`, `ui/undo-toast.tsx`

1. **A failed read renders as an empty state.** `useTransactions.ts`:87, `useAccounts.ts`:38, `useCategories.ts`:36, `useSavingsGoals.ts`:40, `useLoanPurchases.ts`:53 each set an `error` string that the consuming page never reads — so a connection failure shows "No transactions found" and offers "Add transaction". Consume `error` before `isEmpty` on every list page.
2. **Raw Postgres messages are user-facing copy.** ~20 sites surface `error.message` verbatim: `useAccounts` (:38, :90, :105, :124, :162), `useLoanPurchases` (:53, :71, :100, :125, :139), `useExchangeRates` (:116, :154, :204), `useBudgets` (:59, :88), `useCategories` (:36, :106), `useSubcategories`:106, `useTransactions`:87, `useSavingsGoals`:40, `SettingsPage`:274. Map the codes that actually occur (unique violation, RLS denial, connection failure) to sentences; keep raw text collapsed for support.
3. **No notification surface.** `ui/undo-toast.tsx` is used only by `TransactionsPage` and `AccountTransactionsPage` for undo-delete. Add one surface with three severities: success + undo, failure + retry, partial failure + fix.
4. **Three errors reach the console only.** `AuthContext.tsx`:40 (profile fetch), :55 (`getSession`), :87 (sign out). A silent sign-out failure leaves the user believing they signed out.
5. **Partial failure needs a pattern.** `AccountTransactionsPage.tsx`:536 is the only instance and the copy is good — reuse its shape wherever a two-phase write can half-succeed.
6. **Error boundary is four words.** `ui/error-boundary.tsx`:32 renders "Something went wrong." with no retry. Scope to the failed section, state what is safe, offer recovery.
7. **`role="alert"` appears in one file** (`LoanPurchaseTracker`, 4 uses). The other ~20 inline errors are unannounced.
8. **Nine copies of `text-sm text-destructive px-1 -mt-2`** across `BudgetsPage` (4), `AccountTransactionsPage` (3), `CategoriesPage` (2). One `<FormError>` component removes all nine.
9. **Off-system colours** in `BudgetsPage.tsx`:641 — `bg-yellow-500` / `bg-emerald-500` where `GOLD` / `INCOME` exist.

### 5.14 Loading & skeleton states [25a] — `src/components/ui/skeleton.tsx` + 14 call sites

The primitive exists and is used widely. Four problems around it:

1. **Four hand-rolled pulses.** `ReportsPage.tsx`:948, :1186, :1236 use `<div className="h-full w-full rounded-lg bg-muted animate-pulse" />` and :1285 uses `h-8 rounded-lg bg-muted animate-pulse` — while the same file imports `Skeleton` on :40 and uses it correctly six other times. Replace with `<Skeleton>`.
2. **Five radii for one component.** `Skeleton` hard-codes `rounded-md`; call sites override with `rounded-xl`, `rounded-2xl`, `rounded-[20px]`, `rounded-lg` and `rounded`. Cards are 20px — decide whether the default matches the card radius or whether every call site passes one.
3. **Skeletons should describe their target.** Replace flat blocks with structured skeletons: keep the row grid, icon tile and dividers real, grey only the text runs. Prevents layout shift on load; see 25a for the side-by-side.
4. **Separate first-load from refetch.** Stepping the month cycle currently swaps content for skeletons despite data being on screen. Keep the previous cycle visible at reduced opacity with a progress rule and a named target; preserves scroll position.
5. **State the spinner rule.** `Loader2 animate-spin` in `ImportCSVDialog`/`TransactionForm` vs pulse everywhere else: spinner for a user-triggered action, skeleton for content arriving.
6. **The shell never loads** — nav, period stepper, title and primary action depend on no query and should be interactive from the first frame.

### 5.15 Categories [8a], Settings [7a], Account detail [4a], Activity [3a], Login [11a], 13th Month [15a]

Annotations live beside each mockup. The highest-value items:

- **Login** — the page never says what the product does; a stranger sees a wordmark, a five-word tagline and a Google button. Also `max-w-100` centres a phone-width column on a 1920 display, and `error_description` is printed raw (*"server_error: unable to exchange external code"*).
- **13th Month** — beyond the encoding bugs (§1.5): the estimate is printed three times on one page; months start collapsed so the include/exclude checkbox sits on a closed row; add "auto-select salary only", since category is already on every record.
- **Account detail** — breadcrumb instead of the back-chevron; balance/limit/statement/due in one band so the right pane can carry payment + category breakdown.
- **Activity** — the freed width finally gives the entry-detail pane a home without squeezing the list.

---

## Part 6 — Suggested order

1. **Part 1 bugs** — independent of everything else, and 1.1/1.3 are data-integrity issues.
2. **`EmptyState` action slot + empty/filtered split** (§4.1–4.2) — smallest change touching the most screens.
3. **2B shell** (Part 2) — unblocks every per-screen layout change.
4. **Global search** (Part 3) — the header affordance ships with the shell, so it shouldn't stay dead long.
5. **Reports, Accounts, Home** (§5.1–5.3) — the three screens that gain most from the width.
6. Everything else, per-screen.

**Ticket breakdown:** `docs/tickets.md` cuts all of the above into build-ready tickets with dependencies, and carries the feature-impact register (what the redesign adds, changes, limits and removes).


## Part 7 — Data volumes and density (answered Sep 17, 2026)

Ceilings to design and test against:

| Dimension | Ceiling |
| --- | --- |
| Transactions per account | ~2,000 |
| Accounts per user | 4–8 |
| Categories | 20–50 |

Drawn in section 29a of `Ledger - 2B Screens.dc.html`.

**V1 — Activity and Account detail must window.** Render a window of rows (60 desktop, 30 mobile) and load on scroll; today both render the full filtered set. Sticky date group headers with per-day item count and net.

**V2 — Sticky result bar.** Above the rows: match count, count of total on the account, active range, and the sum of the match. Sort and density controls live in the same bar. Persists while scrolling.

**V3 — Month jump replaces stepper paging.** A right-hand rail (desktop) / bottom-bar action (mobile) listing months with their net, jumping straight to any of the 24. The period stepper stays for single-step moves.

**V4 — Reports: no pie above 12 categories.** Ranked horizontal bars, top 8 shown, remainder rolled into one expandable "Other · N categories" row carrying its own share. Add Grouped and Treemap views for the 20–50 case.

**V5 — Global search: group, cap, count.** Group results by kind (Transactions / Categories / Saved filters), cap each group at 3, state the true count per group and overall, and offer "See all in Activity". Keyboard hints in the footer, including ⌘F to scope to the current account.

**V6 — Import CSV: group problems by cause.** Error/warning/duplicate counts as a summary strip; a problems-by-cause panel where fixing a cause (e.g. date format D/M/Y) clears every row under it. Errors block import, warnings don't. Problem rows sort first; "Only problems" filter.

**Not affected at these volumes:** Budgets & Goals and Split transaction stay inside their current layouts.

## Part 8 — Dark theme

The document's entire palette is now a single token set (`--kXXXXXX` custom properties, light values on `:root`, dark values on `body.dark`), so all 29 sections render in either theme; the Tweaks `theme` prop switches it. Implementation maps 1:1 onto the token pairs `index.css` already ships — the dark values in the design doc are the reference for the pairing, notably:

- Surfaces: page `#131218`, frame `#1E1D23`, header `#22212A`, card `#26252E`, divider `#38363F`, border `#4C4A55`.
- Ink: primary `#E6E4EA`, secondary `#C3C1CA`, muted `#A9A7B1`.
- Primary: `#A8B4DE` on container `#333C5C`, on-primary text `#1B2135` (dark ink on the lightened accent — do not keep white).
- Semantics: success `#A6D9B0`/`#22362A`, error `#F2B8AE`/`#4A2621`, warning `#E8CE92`/`#3C3320`.
- Category hues step one tint lighter (e.g. `#F97316` → `#FB923C`, `#3B82F6` → `#60A5FA`) so swatches hold against dark surfaces.
