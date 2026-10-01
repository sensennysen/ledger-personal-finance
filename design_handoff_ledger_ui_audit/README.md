# Handoff: Ledger — UI & navigation audit (redesign-v1)

## Overview

An audit of the `redesign-v1` branch of `sensennysen/ledger-personal-finance` covering UI and navigation at desktop, tablet and mobile, plus mockups for every screen and flow in the app.

**If you are an AI coding agent, start at `AGENTS.md`** — read order, hard rules, sequencing gates and a per-ticket definition of done.

**If you are the developer picking this up, start at `specs/tickets.md`** — it cuts everything below into build-ready tickets with dependencies, sizes and acceptance criteria, and opens with a **feature-impact register**: what the redesign adds, changes, deliberately limits, and removes outright. Nothing is blocked — all five open product decisions are resolved and recorded there. This README is the orientation; the specs are the detail; the tickets are the work.

Two separable deliverables:

1. **A navigation change** — the "2B" model: replace the 240px desktop rail / 80px tablet icon rail / 5-item bottom nav with a top bar carrying all destinations as tabs, and a second row carrying the month-cycle stepper and the primary action.
2. **A list of defects and gaps found by reading the source** — data-integrity bugs, contrast failures, silent data loss, dead dependencies and missing flows. Many are independent of the nav change and can ship today.

The mockups cover 30 sections. Every finding was read from the actual source, not inferred from screenshots.

---

## About the design files

**The HTML files in `designs/` are design references, not production code.** They are prototypes showing intended layout, spacing, colour and behaviour. Do not port the markup.

The task is to **recreate these designs in the existing codebase** — React 19 + TypeScript + Vite + Tailwind 4 + shadcn/ui + Supabase — using its established patterns: the `src/components/ui/*` primitives, the design tokens in `src/index.css`, the colour constants in `src/constants/colors.ts`, and the existing hooks in `src/hooks/`.

The designs are inline-styled single files with no build step, which is a constraint of the design tool, not a recommendation. Where a mockup hard-codes `#55659A`, the codebase equivalent is `var(--primary)`; the mapping table is in **Design tokens** below.

### How to open them

Each `.dc.html` opens directly in a browser. They are wide (the widest section is ~4,400px across) and pan/zoom horizontally — they are canvas documents, not pages. `support.js` must sit beside them.

- `Ledger - 2B Screens.dc.html` — the main document, 30 sections, newest first. Renders light or dark. Contents index at the top with anchor links.
- `Ledger - 2B Activity.dc.html` — Activity in two visual languages (M3 and Modernist), kept separate because it was the direction-choosing artefact.
- `Ledger - Current UI (redesign-v1).dc.html` — a recreation of what ships today, for before/after comparison.
- `LedgerBottomNav.dc.html`, `LedgerRail.dc.html` — nav shell components the other files import.

Section ids are stable and referenced throughout the specs: `3a`, `4a`, `5b`, `6a` … `30a`.

---

## Fidelity

**High-fidelity.** Final colours, type sizes, spacing and states, drawn at exact device dimensions: 1920×1080 desktop, 768×1024 tablet portrait, 390×844 mobile. Recreate faithfully.

Three caveats:

1. **Colours are the branch's own M3 tokens**, resolved to hex. Use the token, not the hex — see the mapping table.
2. **Data volumes are specified.** Most sections show 3–8 rows for legibility, but the ceilings are now known — ~2,000 transactions per account, 4–8 accounts, 20–50 categories — and section **29a** draws the five surfaces that break at those numbers (Activity, Account detail, Reports, Global search, Import CSV) at full density. Spec §5.
3. **Light and dark.** The whole document renders in either theme from one token set; the `theme` tweak on `Ledger - 2B Screens.dc.html` switches it. Dark values map 1:1 onto the token pairs `index.css` already ships — see spec §6 for the pairing, including the one non-obvious case (on-primary becomes dark ink, not white).

**Viewport coverage.** Verified by enumerating the document, not asserted: all 29 sections carry at least one 768 frame and at least one 390 frame, and every section depicting a full screen also carries 1920. Sections whose subject is a modal or a component (5a, 5b, 12a, 13a, 13b, 14a, 19a, 22a, 23a) show it at its own width on the canvas rather than inside a 1920 device frame — the modal width is the design — and their 768/390 frames show it in situ. Some sections carry extra same-viewport frames for states rather than sizes: 5a has two 390 frames (today's FAB-anchored dropdown vs the proposed sheet), 10a an empty state, 12a an overpayment state, 13a an unbalanced state, 13b a transfer variant, 22a four banner states, and 23a separate budget and goal forms at each of the three sizes.

**Where a section has several frames, treat the desktop frame as canonical.** If a narrower frame appears to show a different field set, the desktop frame is correct — tell us rather than implementing the difference.

---

## PART 1 — Defects in existing features

These are bugs and regressions found while reading source. They need no design decision and mostly no design work. **Ship these first.**

Full detail with file paths and line numbers: `specs/ui-audit-spec.md` §1. Summary:

### 1.1 Data integrity

| # | Finding | File | Severity |
|---|---|---|---|
| 1 | **Offline conflicts are silent data loss.** `drainQueue` compares `updated_at`; when a row changed elsewhere since you queued an edit, it skips the write and calls `console.warn`. The user saw the edit applied locally and is never told it was discarded. | `src/lib/offlineQueue.ts` | High |
| 2 | **Queue items >30 days are deleted silently.** `MAX_QUEUE_AGE_MS` drops stale entries on drain, another `console.warn`. A phone offline over a long trip loses entries the UI promised would sync. | `src/lib/offlineQueue.ts` | High |
| 3 | **Loan repayment auto-picks the first loan.** A `useEffect` calls `handleLoanChange(loanAccounts[0].id)` when none is selected — which also overwrites currency, source account and description. With 2+ loans the form opens against an arbitrary debt and an unnoticed submit records a financially wrong entry. | `src/components/transactions/TransactionForm.tsx` | High |
| 4 | **CSV import has no duplicate detection.** Re-importing a statement, or one overlapping the previous by a few days, creates silent duplicates with no way to distinguish them afterwards. | `src/components/transactions/ImportCSVDialog.tsx` | High |
| 5 | **`inferTransactionKind` collapses card payments into loan repayments.** The check is only `type === 'expense' && toAccountId`, so both branches resolve to `'loan-repayment'`. Must resolve by account type. | `src/components/transactions/transactionKinds.ts` | Medium |
| 6 | **Unitemized loan debt is reported once and then never.** The reconciliation warning renders only when `purchases.length === 0`, inside the create modal — but `getLoanAmountOwed(account)` and the sum of purchases can diverge at any later time, and the gap is debt with no schedule and no deadline. | `src/components/accounts/LoanPurchaseTracker.tsx` | Medium |
| 7 | **Two account forms with two schemas.** `AccountForm` (in `AccountsPage.tsx`) creates; a separate `EditAccountForm` with its own `accountSchema` (in `AccountTransactionsPage.tsx`) edits — and the edit schema has **no `loan_pay_period` and no `loan_due_days`**. You can create a loan with a repayment schedule and never change it. | both pages | Medium |
| 8 | **`monthly_interest_rate` has no maximum.** Validated `min(0)` only, so `125` instead of `1.25` is accepted and silently produces a 31× installment. | `src/components/accounts/LoanPurchaseForm.tsx` | Medium |

### 1.2 Visible bugs

| # | Finding | File |
|---|---|---|
| 9 | **Two encoding errors render on screen.** The subtitle shows `Computed under PD 851 <?>`, the card title `Income Records <?> 2026`, and the transaction meta line uses the same broken byte as a separator — an en dash written in a non-UTF-8 encoding. Three replacement characters, one in the first sentence a user reads. | `src/pages/ThirteenthMonthPage.tsx` |
| 10 | **"Reconnecting…" is false.** Shown when `isOnline && !isSyncing && pendingCount > 0` — you are already online; the drain simply isn't running. `useNetworkStatus` exports `syncNow` and the banner never calls it. | `src/components/layout/OfflineBanner.tsx` |
| 11 | **"Balanced ✓" with a dead Split button.** The dialog opens with line 1 at the full amount and line 2 at zero, so `diff === 0` and the label goes green — but `valid` also requires every line to have a description and non-zero amount, so the button is disabled. Green tick, dead button, no explanation. | `src/components/transactions/SplitTransactionDialog.tsx` |
| 12 | **"over budget" on a screen with no budgets.** Split's imbalance message reads `$40.00 over budget`; it's an over-allocation of one transaction. Misdirects to the Budgets feature. | same |
| 13 | **`'Recur'` rendered as an icon.** `item.tx.category?.icon ?? 'Recur'` puts the literal word in an icon-sized slot where every sibling shows an emoji. | `src/components/dashboard/DashboardCashFlowForecastCard.tsx` |
| 14 | **Raw date string in the detail pane.** `transaction.date` is printed unformatted — `2026-09-09` — while every other surface formats. | `src/components/transactions/EntryDetail.tsx` |
| 15 | **`/terms` has no `routeMeta` entry** while `/privacy` and `/data-deletion` do, so it falls through to the generic page title. | `src/App.tsx` |
| 16 | **Auth errors print `error_description` raw.** Sanitised correctly, but `server_error: unable to exchange external code` is Supabase's wording, not a next step. | `src/pages/LoginPage.tsx` |
| 17 | **The kind is asked twice.** `TransactionKindMenu` collects Expense/Income/Transfer/Loan repayment before the dialog opens; `TransactionForm` then renders a three-way type selector as its first control, pre-set to that value. Same decision, two seconds apart. Fix in `add-transaction-spec.md` §3.5. | `TransactionForm.tsx`, `TransactionKindMenu.tsx` |
| 18 | **Session-restore and sign-in share a label.** `loading` from `AuthContext` is true during the initial `getSession()`, so on a cold load the button reads "Signing in…" and is disabled before the user has clicked anything. | same |

### 1.3 Contrast failures

All measured. WCAG AA requires 4.5:1 for body text, 3:1 for large text and UI chrome.

| # | Element | Current | Ratio | Fix |
|---|---|---|---|---|
| 18 | `#B4574A` expense text on `#F5DEDA` container | 3.1:1 | fails AA | `#8F3F33` → 5.54:1 |
| 19 | Placeholder figures `#B6B4BD` on `#F5F4F7` | 1.87:1 | fails | `#6B6A72` → 4.88:1 |
| 20 | Disabled nav labels at `opacity:0.5` on light grey | 1.98:1 | fails | solid `#8A8892` (3.3:1) + a lock glyph; opacity reads as broken, not inactive |

The third recurred three times in my own mockups (17a, 18a, 23a) before being caught — it's an easy mistake to repeat.

### 1.4 Dead code and off-system styling

| # | Finding |
|---|---|
| 21 | **`cmdk` ships and powers nothing.** `src/components/ui/command.tsx` is ~190 lines including a working `CommandDialog`; its only consumer is `AccountCombobox`, an account picker. The palette is already in every user's bundle. |
| 22 | **`EmptyState` has no action prop.** 20 lines taking `icon`/`title`/`description` only — so Accounts says "Add your first account to get started" with no button. A 3-line change fixes every use. Only 3 screens use it; 8 other places hand-roll a muted `<p>`. |
| 23 | **Empty and filtered-empty share one message.** `TransactionsPage.tsx:573` and `AccountTransactionsPage.tsx:953` both render `title="No transactions found"` — for zero transactions ever, and for eighteen excluded by a filter. Opposite fixes: create a record vs widen the filter. |
| 24 | **Raw Tailwind palette on Home.** The credit-card reminder strips use `amber-500/30`, `amber-700`, `sky-500`, `sky-700` — the only place on Home outside the app's own `INCOME`/`EXPENSE`/`GOLD` constants. Gold already means "liability due" everywhere else. |
| 25 | **Gold means "selected" in exactly one place.** Reports' active date preset uses `background: GOLD` with `--primary-foreground`. |
| 26 | **Four decorative layers on a legal page.** `DataDeletionPage` opens with a 700×500 radial gradient, a 3%-opacity dot grid and two ~500px bordered circles bleeding off-canvas, before any content. |
| 27 | **Dark mode is reachable only from the mobile More sheet.** No desktop or tablet entry point. |
| 28 | **`/categories` has no desktop or tablet nav entry at all** — mobile More sheet only. |
| 29 | **The month cycle is rendered by four different controls** across the app. |
| 30 | **Google's mark on a non-white ground.** The sign-in button puts the multicolour glyph on `--primary` with white text, which Google's identity guidance disallows. |
| 31 | **Two logo assets swapped on theme.** `/l-black.png` and `/l-white.png` keyed to `theme`, so the mark can't respond to a system theme change without a re-render. |
| 32 | **Four hand-rolled skeleton pulses.** `ReportsPage.tsx`:948, :1186, :1236 use `<div className="h-full w-full rounded-lg bg-muted animate-pulse" />` and :1285 uses `h-8 rounded-lg bg-muted animate-pulse` — reimplementing `<Skeleton>` inline while the same file imports it on :40 and uses it correctly six other times. Replace with the primitive. (25a, spec §5.12) |
| 33 | **One skeleton component, five radii.** `Skeleton` hard-codes `rounded-md`; call sites override with `rounded-xl`, `rounded-2xl`, `rounded-[20px]`, `rounded-lg` and plain `rounded`. Cards are 20px, so a skeleton standing in for one is the wrong shape. Decide whether the default matches the card radius or every call site passes one. (25a, spec §5.12) |
| 34 | **A failed read renders as an empty state.** `useTransactions.ts`:87, `useAccounts.ts`:38, `useCategories.ts`:36, `useSavingsGoals.ts`:40 and `useLoanPurchases.ts`:53 set an `error` the page never reads — a connection failure shows "No transactions found" and offers "Add transaction". Consume `error` before `isEmpty`. (26a, spec §5.13) |
| 35 | **Raw Postgres messages shown to users.** ~20 sites surface `error.message` verbatim, so a unique-constraint violation reads as `duplicate key value violates unique constraint "categories_user_id_name_key"`. (26a, spec §5.13) |
| 36 | **Three errors reach the console only.** `AuthContext.tsx`:40, :55, :87 — the sign-out failure at :87 is silent, so the user believes they signed out on a device where they did not. (26a) |
| 37 | **Error boundary is four words.** `ui/error-boundary.tsx`:32 renders "Something went wrong." with no retry and no reload. (26a) |
| 38 | **`role="alert"` on 4 messages in one file**, absent from the other ~20 inline errors, so screen readers never announce them. (26a) |
| 39 | **Nine verbatim copies of `text-sm text-destructive px-1 -mt-2`** — a negative-margin hack across `BudgetsPage` (4), `AccountTransactionsPage` (3), `CategoriesPage` (2). One `<FormError>` removes all nine. (26a) |
| 40 | **Off-system colours in budget bars.** `BudgetsPage.tsx`:641 uses `bg-yellow-500` / `bg-emerald-500` where the app has `GOLD` / `INCOME`. Same class as #24. (26a) |
| 41 | **`aria-current` has zero occurrences in the codebase.** `Sidebar.tsx` and `BottomNav.tsx` mark the active destination by background tint alone, so a screen reader cannot tell which destination you are on. **Blocking for 2B** — it puts seven tabs where the rail was. (27a, spec §5.14) |
| 42 | **Four clickable rows are focusable but not operable.** `DashboardCategoryPieCard`:29, `BudgetsPage`:1090, `TransactionsPage`:481, `TransactionRow`:177 set `tabIndex={0}` with no `onKeyDown` — Tab reaches them, Enter does nothing. (27a) |
| 43 | **Reduced motion covers four class names only.** `animate-pulse` (all skeletons), `animate-spin` (5 sites) and the whole `animate-in`/`zoom`/`slide-in-from-*` set on dialog, sheet, dropdown, popover, tooltip and select still animate. Reads as complete; is not. Two separate `@media` blocks to merge. (27a, spec §5.14) |
| 44 | **Eleven ad-hoc durations, no token; the correct easing curve is unnamed.** 100–500ms scattered across CSS and Tailwind classes. `cubic-bezier(0.22, 1, 0.36, 1)` is applied consistently but is not a variable, so new Tailwind transitions get `ease`. (27a, spec §5.14) |
| 45 | **Two focus-ring widths.** `ui/` primitives use `focus-visible:ring-3`, hand-rolled rows use `ring-2`. (27a) |
| 46 | **No skip link.** Nine keyboard stops from page load to content at 1920 under 2B. (27a) |

---

## PART 2 — Features that do not exist yet

New work. Each needs a product decision before implementation.

| Feature | Design | Spec | Notes |
|---|---|---|---|
| **Global search / command palette** | `16a` | §4.1 | Highest value per unit of effort — `cmdk` and `CommandDialog` already ship (Part 1 #21). Searches descriptions, payees, accounts, categories; numeric queries match exact amount then ±5%; commands (E/I/T) carry the query into the form; empty state offers record actions, due-soon items and jump-to for all destinations. The ⌘K affordance in every 2B header assumes this exists. |
| **Card payment flow** | `12a` | `add-transaction-spec.md` §1.3 | Paying a card is likely the most common liability action and has no flow — you record a manual expense and hope the balance lands right. **Not the loan form relabelled:** loans cap the amount at outstanding, cards must not, because `getAccountAssetBalance` already treats a positive card balance as an overpayment. Requires a new `'card-payment'` kind. |
| **Kind menu as a bottom sheet on mobile** | `5a` | `add-transaction-spec.md` §1.4 | The menu is a Radix `DropdownMenu` anchored to the corner FAB on mobile — a 288px panel over the bottom nav with wrapping descriptions. `ui/sheet.tsx` already ships and *More* already uses it, so this is a trigger swap below `md`. |
| **Loan picker** | `5a`, `5b` | `add-transaction-spec.md` §2 | Fixes Part 1 #3. 0 loans → item hidden; 1 loan → skip the picker (current auto-pick is correct there); 2+ → picker first, `to_account_id` starts `null`. Narrow the `useEffect` from `length === 0` to `!== 1`. |
| **Notification surface** | `26a` | §5.13 | No toast system exists — `ui/undo-toast.tsx` serves undo-delete on two pages only. One surface with three severities (success + undo, failure + retry, partial failure + fix) replaces ~20 inline `<p>` errors. |
| **Offline queue review** | `22a` | §4.2 | Needed to make Part 1 #1 and #2 visible. Lists queued writes, flags conflicts, offers keep-mine / keep-theirs, exposes `syncNow`, states that the queue lives in `localStorage` and is lost with site data. |
| **First-run experience** | `20a` | §3.3 | None exists. A new user lands on Home with every widget rendering its own empty message. Three ordered steps matching the real dependency chain: account → transaction → pay cycle. Skippable. |
| **CSV duplicate detection + category suggestions** | `10a` | §2.2 | Fixes Part 1 #4. Also: `category_id: null` is hardcoded for every imported row and the dialog apologises for it twice — a payee→category memory from past transactions gets most rows right. Also selectable rows (currently all-or-nothing) and transfer recognition (`ImportTx` allows only income/expense, so an internal transfer imports twice and inflates both totals). |
| **Budget rollover** | `23a` | §3.1 | **Needs a decision before design is final** — see Open decisions. |
| **Goal contribution flow** | `23a` | §3.2 | Goals have a target and a current amount and no way to contribute except a manual transfer. |
| **List windowing** | `29a` | §5 |  Required, not an optimisation, at ~2,000 rows per account: a rendered window (60 desktop / 30 mobile) loading on scroll, a sticky result bar carrying count + sum + sort, and a month-jump rail replacing 24 stepper clicks. Reports drops the pie above 12 categories for ranked bars with an expandable tail; search groups and counts; CSV import groups problems by cause. |
| **Transaction detail on tablet/mobile** | `13b` | §2.4 | The pane is `lg:`-only; below that, tapping a row opens the edit form. **There is currently no way to look at a transaction on a phone without entering edit mode on it.** Also: `EntryDetail` offers only `onEdit` — no delete, and no entry point to Split from the transaction you'd split. |

---

## PART 3 — Changes to existing features

Redesigns of things that work. Full per-screen detail in `specs/ui-audit-spec.md` §2, §3 and §5.

### 3.1 The navigation change (2B)

Applies to every screen. Designs: `3a` (Activity, the reference implementation), then all others.

**Desktop 1920** — no rail. A 64px top bar: brand, seven destination tabs as pills, ⌘K search field, theme toggle, settings, avatar. A 56px second row: page title, the month-cycle stepper, page-level filters, primary action.

**Tablet 768** — same structure; tabs scroll horizontally in a 52px row; stepper and action share a 56px third row.

**Mobile 390** — unchanged from today's 5-item bottom nav + FAB. 2B is a desktop/tablet change.

Why: the current `240px` rail plus `max-w-5xl` page caps mean a 1920 display shows a 1024px column with ~660px of empty gutter. Removing the rail returns that width to content, and seven visible tabs fixes `/categories` having no desktop entry (Part 1 #28).

**Alternatives considered and rejected:** `2a` grouped rail (smallest diff, keeps the rail), `2c` M3-native docked FAB (kills the vanishing FAB and 176px of dead scroll). Both are in `Ledger - Current UI (redesign-v1).dc.html` if you want to reconsider.

### 3.2 Tablet behaviour (768) — decisions the frames settle

The tablet frames answer four breakpoint questions that were open:

1. **Three columns become two, not one.** Home (18a) keeps a two-column widget grid at 768; the net-worth card absorbs the income and expense cells and Recent Transactions runs two-up across the full width. Reports (9a) and Accounts (6a) do the same.
2. **Detail panes take the dialog branch, and `lg:` is correct as written.** Docking a pane at 768 leaves too little for the content beside it: the dashboard pane is 340px (`DashboardDetailSurface.tsx`), leaving 428px, and the Activity pane is 380px, leaving 388px. Both are under the ~560px the three-column dashboard grid and the six-column transaction table need to stay legible, so 17a and 13b each render as a surface — dialog and sheet respectively — not a pane. **Do not move the `lg:` breakpoint down**; fix what is below it instead (Part 2, transaction detail).
3. **The kind menu dropdown/sheet boundary is 768.** There is no FAB at tablet width, so the dropdown is correct at and above 768, anchored under the header Add button. The bottom sheet applies below it (`add-transaction-spec.md` §1.4).
4. **Modals fill the width at a 24px inset.** The 720px desktop modals (12a, 13a, 14a, 19a) keep their internal grids — field pairs, three-cell bands, the 4×2 account-type grid, split rows. Nothing reflows to a single column, which is what preserves the reason each layout was chosen.

Two things shed at 768: the Reports table drops to five columns (Type goes; the signed amount carries it) and search result rows drop the "open in" column. Key hints stay — a tablet has a keyboard often enough to earn them.

### 3.3 Per-screen changes

| Screen | Design | Headline change |
|---|---|---|
| Home | `18a` | Three columns instead of one; Upcoming Bills becomes a ruled strip not a card; Credit Card Monitor stops nesting boxes four deep; stat cards get vs-previous-cycle comparisons |
| Accounts list | `6a` | Drops `max-w-5xl`; assets and liabilities side by side; share bar per asset row; excluded-currency warning moves onto the row that's excluded; liability cards get Pay/Repay actions |
| Account detail | `4a` | Breadcrumb replaces the back-chevron; balance/limit/statement/due share one ruled band; right pane carries payment + category breakdown |
| Activity | `3a` | Entry-detail pane gets a home at 1920 without squeezing the list |
| Budgets & Goals | `4b` | Segmented views, because the header period applies to budgets but not goals; over-budget bars cap at 100% with the true % in the number |
| Transaction entry | `4c` | **Kind asked once, not twice** — the kind menu already collects it, so the create modal drops its duplicate type selector and states the kind in the title (with a *Change kind* link back); the selector moves to the edit variant, where it is the only way to fix a mis-typed entry. Desktop is a modal over the page you were on, not a route; **mobile keypad removed** (the amount raises the OS keyboard; reclaimed space goes to Payee, Note, tags, recurring) |
| Reports | `9a` | Every number gets a comparison; two full-width control cards fold into the header (~240px of chrome); one set of controls instead of a `hidden md:flex` / `md:hidden` pair; charts stop being `h-52` at every viewport; all seven table columns visible |
| Categories | `8a` | Gets a real desktop screen |
| Settings | `7a` | Dark mode gets a home here |
| Login | `11a` | Two-panel at 1920 (currently `max-w-100` centred, ~80% empty); **the page never says what the product does** |
| 13th Month | `15a` | Fixes the encoding bugs; the estimate is currently printed three times on one page; "auto-select salary only" turns a 21-row manual pass into a review |
| Split transaction | `13a` | Remainder becomes one tap; lines become rows not stacked cards |
| Loan purchase form | `14a` | **The cost of borrowing is never named** — `totalPayable` is shown, interest (`totalPayable − principal`, one subtraction) is not. At 1.25% flat over 24 months that's $720 on $2,400. Also: term and rate are on different steps, so you can't see the trade-off |
| Loan purchase tracker | `21a` | Deadlines stop paging four at a time; next payment gets an action; imported-as-paid distinguished from actually repaid in the progress bar |
| Account form | `19a` | One form for create and edit (Part 1 #7); type as a visible 8-cell grid; liability sign explained where it's entered; all four `superRefine` schedule branches visible |
| Legal pages | `24a` | One shared `<LegalPage>` for all three |

---

## Decisions (resolved 2026-09-17)

All four previously-blocking decisions are settled. Full detail in `specs/ui-audit-spec.md` → **Decisions**.

| # | Decision | What it requires |
|---|---|---|
| **D1** | **Budget deficit becomes user-controlled.** Carrying it (current behaviour) was judged punishing. | New `budget_deficit_behaviour` — `'carry' \| 'reset'`. Global setting in Settings → Budgets. Default `'reset'` for new users, **`'carry'` for existing users on upgrade** so no figures change under them. The per-budget "Rollover unused budget" toggle keeps its meaning (surplus only) — the two are independent. |
| **D1b** | **Overspending is reported, not lost.** | Reports gains an **Overspending** section: per cycle, per category, amount over, consecutive cycles over. Populated under both settings. Derivable from existing data — no new write path. |
| **D2** | **13th Month is a route, not a tab.** | Remove it from the `TabsContent` in `ReportsPage.tsx`; keep `/thirteenth-month`. Reports drops to two tabs and links out. |
| **D3** | **Reports follows the global monthly cycle.** | Remove the seven presets (`useReportPresets`); use `useMonthCycle` and show the row-2 stepper. **Supersedes the "Reports is the exception" note.** Trend charts keep an independent 12-month lookback — a bar chart scoped to one cycle is one bar. |
| **D4** | **Card payment ships** as a new flow. | Build 12a + the `'card-payment'` kind. The `inferTransactionKind` fix (Part 1 #5) is needed either way. |

All five follow-on product decisions (deficit clamping, upgrade default, preset deprecation, import-duplicate default, first-run blocking) are resolved in `specs/tickets.md` → **Decisions**. **Design for these is drawn in section 28a** — the D1 setting, the revised budget form, the D1b Overspending report and the D3 stepper-plus-lookback split, at all three viewports. One open sub-question is flagged there: whether a carried deficit should be capped so a budget cannot open negative.

## Design tokens

Mockups use resolved hex. **Use the token, not the hex.**

### Colour

| Mockup hex | Codebase token | Role |
|---|---|---|
| `#EFEEF2` | `--background` | page ground |
| `#FAF9FB` | `--card` | card surface |
| `#F3F2F6` | `--muted` / header ground | secondary surface |
| `#F1F0F4` | `--muted` (nested) | tertiary fill |
| `#F5F4F7` | — | zebra row / nested panel |
| `#D9D7DE` | `--border` | hairline rule |
| `#B6B4BD` | `--input` | field border, strong rule |
| `#2B2A30` | `--foreground` | primary ink |
| `#55545B` | — | secondary ink (4.5:1+) |
| `#6B6A72` | `--muted-foreground` | tertiary ink |
| `#55659A` | `--primary` | accent, links, active |
| `#E4E7F5` | `--primary-container` | accent tint |
| `#2E3A63` | `--on-primary-container` | ink on accent tint |
| `#3D7A4A` | `INCOME` | income, positive |
| `#2C5B37` | — | income text on tint (AA) |
| `#DCEEDF` | `--income-container` | income tint |
| `#B4574A` | `EXPENSE` | expense, negative |
| `#8F3F33` | — | **expense text on tint (AA — see Part 1 #18)** |
| `#F5DEDA` | `--expense-container` | expense tint |
| `#3F6E93` | `TRANSFER` | transfer |
| `#DCEAF2` | — | transfer tint |
| `#9A7F3D` | `GOLD` | loans, liabilities, pending |
| `#7A6430` | — | gold text on tint (AA) |
| `#F0E7D2` / `#FBF4E8` | — | gold tint / pale gold |

Category dot colours come from `src/constants/colors.ts` and are used verbatim: `#22c55e` `#f97316` `#3b82f6` `#eab308` `#14b8a6` `#a855f7` `#6366f1` `#ec4899`.

### Type

Roboto (UI) + DM Mono (all monetary values and dates — `font-variant-numeric: tabular-nums`, `letter-spacing: -0.025em`).

| Use | Size / weight |
|---|---|
| Page title | 20–22px / 700, `-0.01em` |
| Section heading | 15px / 600 |
| Kicker | 11px / 700, uppercase, `0.1em` |
| Body | 13–14px / 400–500 |
| Label, meta | 12px / 400 |
| Hero figure | 30–48px / 700, `line-height: 1` |
| Card figure | 19–26px / 700 |

### Spacing, radius, elevation

4px base. Card padding 18–24px desktop, 14–18px mobile. Page padding 24–32px desktop, 16px mobile. Grid gaps 12–20px.

Radius: `999px` pills · `28px` modals and hero cards · `20px` cards · `16px` nested panels · `14px` inline tints · `12px` fields · `10–12px` icon tiles · `6px` key caps.

Shadow: `0 1px 2px rgba(0,0,0,0.10)` resting · `0 4px 8px rgba(0,0,0,0.20)` FAB · `0 8px 24px rgba(0,0,0,0.28)` modal · `0 12px 32px rgba(0,0,0,0.30)` palette.

### Layout

Desktop 1920×1080 · tablet 768×1024 · mobile 390×844. Nav rows 64px + 56px. Mobile bottom nav 80px; FAB 56px at `right:16px; bottom:96px`. Touch targets ≥44px. Detail panes 380–420px. Modals 640–1280px by content.

---

## Known issues in the mockups themselves

Three defects recurred while building these, all the same root cause — worth watching for in implementation:

1. **`min-height: auto` on flex/grid children inside `overflow: hidden`.** A grid track or `flex:1` parent does not constrain a child that hasn't been given `min-height: 0`; the child silently overflows and gets clipped. Hit in 18a, 23a and 24a.
2. **`content-box` plus large padding on a `flex:1` element.** Padding adds *on top of* the computed height. Set `box-sizing: border-box`.
3. **`opacity` for disabled states.** Fails contrast and reads as broken. Use a solid muted colour plus an affordance (lock glyph).

---

## Assets

No image assets. Icons are Lucide (already a dependency) — the mockups load the UMD build from unpkg for convenience; use the existing `lucide-react` imports. Category icons are emoji, matching the current `category.icon` field. Fonts are Roboto and DM Mono from Google Fonts.

---

## Files in this bundle

```
AGENTS.md                                  agent operating procedure
designs/
  Ledger - 2B Screens.dc.html              30 sections — the main document
  Ledger - 2B Activity.dc.html             Activity in two visual languages
  Ledger - Current UI (redesign-v1).dc.html  what ships today, for comparison
  LedgerBottomNav.dc.html                  mobile nav component
  LedgerRail.dc.html                       desktop rail component (current design)
  support.js                               runtime — must sit beside the .dc.html files
specs/
  ui-audit-spec.md                         the full audit: every finding, file-referenced
  add-transaction-spec.md                  add-transaction, loan picker, card payment
  tickets.md                               START HERE — tickets, dependencies, feature-impact register
  github.md                                repo, branch, screen→source map
screenshots/                               flat PNGs of 3a, 9a, 16a, 18a, 29a
```

### Section index

| id | Screen or flow | id | Screen or flow |
|---|---|---|---|
| `3a` | Activity (2B reference, M3) | `13b` | Transaction detail pane |
| `3b` | Activity (Modernist variant) | `14a` | Loan purchase form |
| `4a` | Account detail | `15a` | 13th Month Pay |
| `4b` | Budgets & Goals | `16a` | Global search **(new)** |
| `4c` | Transaction entry | `17a` | Dashboard detail surface |
| `5a` | Add-transaction kind menu | `18a` | Home |
| `5b` | Record loan repayment **(new)** | `19a` | Account form |
| `6a` | Accounts list | `20a` | Empty & first-run **(new)** |
| `7a` | Settings | `21a` | Loan purchase tracker |
| `8a` | Categories | `22a` | Offline & sync |
| `9a` | Reports | `23a` | Budget & goal forms |
| `10a` | Import CSV | `24a` | Legal pages |
| `11a` | Login | `25a` | Loading & skeleton states |
| `12a` | Card payment **(new)** | `26a` | Error states |
| `13a` | Split transaction | `27a` | Motion & focus order |
| `28a` | Decisions D1–D3, drawn | `29a` | Dense states at real volume |
| `30a` | Trend lookback (LED-21a) | | |

Each section in the HTML carries its own "What changed, and why" list beside the frames, with the file-level reasoning for every change.

---

## Suggested order

Ticket-level ordering, with dependencies, is in `specs/tickets.md`. The summary:

1. **Part 1 §1.1 and §1.2** — data integrity and visible bugs. No design dependency, no decisions needed.
2. **Part 1 §1.3** — contrast. Mechanical.
3. **Global search** (`16a`) — highest value per unit of effort; the dependency already ships.
4. **The 2B nav shell** (`3a`) — then roll it across screens.
5. **Answer the four open decisions**, then the rest of Part 2.
6. **Part 3 per-screen redesigns**, in whatever order matches your priorities.
7. **Density work (`29a`, spec §5)** — do windowing and the result bar with the Activity rebuild rather than after it; retrofitting virtualisation into a finished list costs more than building it in.
