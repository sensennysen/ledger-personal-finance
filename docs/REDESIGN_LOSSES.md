# Redesign — removed / unused capabilities

The blue/indigo M3 redesign (`~/Downloads/Application redesign project.zip`) is being
applied **literally to the mockups**. Where a mockup omits an existing feature, the
feature is removed from the UI. This file tracks every such loss so it can be
reconsidered later. Underlying hooks / `lib` / data code is left intact unless noted —
only the UI surface is trimmed.

---

## Phase 1 — Design tokens & primitives

No feature loss. Visual layer only:

- `src/index.css` `:root` / `.dark` / `@theme inline` rewritten from the gold M3 seed
  to the handoff's blue/indigo scheme. Existing shadcn variable names keep their
  meaning; added roles: `--primary-container`, `--on-primary-container`,
  `--secondary-container`, `--on-secondary-container`, `--surface-container`,
  `--surface-container-high`, `--nav-container`, `--outline`, `--outline-variant`,
  `--gold`, `--gold-container`, `--el1`, `--el3` (plus matching `--color-*` /
  `--shadow-*` utilities).
- `[data-slot="card"]` now carries `var(--el1)` instead of `box-shadow:none`.
- `Dialog` content: `rounded-[28px]` + `shadow-[--el3]`.
- `src/constants/colors.ts`: `GOLD` now resolves to `var(--gold)` (was `var(--primary)`);
  added `GOLD_CONTAINER`.
- `ThemeContext`: default accent seed is now `#55659a`; `theme-color` meta updated;
  custom-accent picker also seeds `--primary-container` / `--on-primary-container`.

---

## Phase 2 — Navigation shell

Files: `src/components/layout/{Sidebar,BottomNav,AppLayout}.tsx`.

**Removed:**

- **Sidebar collapse/expand toggle** and its collapsed-state tooltips. The desktop
  rail is now fixed-width (240px ≥1024, 80px icon rail 768–1023).
- **Sidebar quick theme toggle.** Theme is now changed only in Settings → Appearance
  (Phase 9) and the mobile **More** sheet. `useTheme().toggleTheme` still exists.
- **Categories has no desktop navigation entry.** The handoff's desktop sidebar is
  Home / Accounts / Activity / Budgets / Reports / Settings only. On desktop,
  `/categories` is reachable by URL only; on mobile it's in the **More** sheet.
- **"13th Month" removed from the More sheet** (mockup shows only Categories /
  Reports / Settings). Still reachable via `/thirteenth-month` and, after Phase 8,
  the Reports "13th Month" tab.
- **More sheet no longer shows the account identity block** (name / email /
  "N pending changes"). Identity still appears in the desktop sidebar footer and
  Settings → Profile. Offline/pending status still shows in the mobile header +
  `OfflineBanner`.
- Bottom nav lost its `rounded-t-[28px]` corner (mockup uses a plain top border).

**Changed (not a loss):** bottom nav is now 5 items (Home / Accounts / Activity /
Budgets / **More**); More opens the existing sheet host (`sheet === 'account'`).
FAB is 56px `rounded-[16px]` with `--el3`. Logo is a text "L" badge (was
`l-black/white.png`).

---

## Phase 3 — Home / Dashboard

File: `src/pages/DashboardPage.tsx` rewritten to the handoff's 6 sections
(month stepper + Add, Net Worth hero + income/expense tiles, Cash Flow bars,
Credit Card, Recent Transactions). `useDashboardData` is still the data source.

**Removed from the Home screen** (components left on disk, now unreferenced —
`src/components/dashboard/*`, `src/hooks/useDashboardPrefs.ts`,
`useSpendingAlerts.ts`, `useFlipReorder.ts`, `src/contexts/widgetDragState.ts`):

- **Configurable widget system**: show/hide widgets, drag-reorder, the
  `DashboardWidgetSettingsSheet`. Home now has a fixed layout.
- **"Needs attention" / spending-alert banners** (budget-exceeded, large
  transaction) — `useSpendingAlerts` + dismiss state.
- **Upcoming Bills card** (`DashboardUpcomingBillsCard`) — recurring + loan bills
  due this cycle.
- **Category pie / expenses-by-category card** (`DashboardCategoryPieCard`).
- **Budget progress card** (`DashboardBudgetProgressCard`).
- **Cash-flow forecast card** (`DashboardCashFlowForecastCard`) — projected
  income/expenses/balance from recurring series.
- **Dashboard detail dialogs / desktop entry-detail side surface**
  (`DashboardDetailDialogs`, `DashboardDetailSurface`) — tapping a stat card
  no longer opens an in-place breakdown. Transaction rows still open the shared
  entry-detail sheet.
- **Credit-card monitor for multiple cards** (`DashboardCreditCardMonitor`) — the
  new Credit Card card shows only the first credit-card account.
- **"Weekly" cash-flow granularity** — segmented is now Daily / 3 mo / 12 mo only.
- Cash-flow chart is now a plain CSS bar chart (no Recharts axes / tooltip /
  y-axis scale labels) and the income series is drawn in `--primary`, not
  `--income`, per the mockup.
- Automatic **credit-card statement-balance locking** effect is retained (kept as
  a background `useEffect` in the rewritten `DashboardPage`).

---

## Phase 4 — Accounts

File: `src/pages/AccountsPage.tsx` rewritten. `AccountForm` (the Add/Edit modal
body, all credit-card + loan fields) is kept and **exported** for Phase 5.
`createAccount` flow unchanged.

**Removed:**

- **Per-account ⋯ menu on the list** (Edit / Delete). Editing and deleting an
  account is now only possible from that account's **detail** page (Phase 5).
  `updateAccountWithAdjustment` / `deleteAccount` are no longer called here.
- **Flat vs. grouped account view** toggle + persistence (`prefs.accView`,
  `prefs.accGroupOrder`, `profile.account_group_order`). The list is now a fixed
  **Assets** vs **Liabilities** split (liabilities = `credit_card` + `loan`).
- **Grouping by every account type** (Cash / Checking / Savings / Investment / …
  headers). Collapsed to the two-way Assets/Liabilities split.
- **Drag-reorder** of accounts and of type-groups; up/down arrow reordering;
  "Rearrange accounts" mode. `updateAccountOrder` and `useFlipReorder` are no
  longer used on this page (account order still follows the hook's default order).
- **Credit-card reminder badge on the list card** ("Due: N days" /
  "Statement: N days"). Replaced by a single "Due in Nd" chip on liability cards.
- **Sub-notes on asset rows** ("Owed. Subtracted from net worth.", limit line,
  loan schedule) — asset rows now show name + type + balance only; credit/loan
  detail lives on the Liabilities cards.
- `EmptyState` retained; `Badge` component no longer used on this page.

---

## Phase 5 — Account Detail

File: `src/pages/AccountTransactionsPage.tsx` — mostly a **restyle**; the handoff
keeps nearly all functionality (credit-card payment logging, loan
Summary/Purchases/Activity tabs, edit-account, edit/delete transaction, undo
toast).

**Removed:**

- **Credit-card payment-history list** in the hero panel (the scrollable list of
  past logged payments). Payments are still written to `credit_card_payments` and
  to the account (`last_payment_amount` / `last_payment_date`), and the
  "Last payment: $X on <date>" line stays. The history-fetch `useEffect`,
  `paymentHistory` / `paymentsLoading` state, and the `CreditCardPayment` import
  were removed.
- Header fallback title "Account Transactions" → "Account".
- Hero card is a **solid fill** (was a diagonal gradient of the account colour);
  credit cards use solid `--expense`, loans solid `--gold` regardless of the
  account's chosen colour. Other account types still use their own colour.

**Added (restores a Phase 4 loss):** "Delete account" in the hero ⋯ menu, with a
confirm dialog ("Delete "X"?" → archive explanation → red **Delete Account**).

---

## Phase 6 — Activity

Files: `src/pages/TransactionsPage.tsx` rewritten; `TransactionRow.tsx` reworked.

**Removed:**

- **Import CSV** — `ImportCSVDialog` is no longer surfaced (file kept on disk).
  `handleImport` / `bulkCreateTransactions` usage removed from the page.
- **Bulk re-categorize** — the multi-select "Re-categorize" action + its dialog.
  Bulk **delete** + select-all/deselect are kept. `bulkUpdateCategory` unused here.
- **Tag filter chips** (desktop chip row) and `activeTagFilter` filtering.
- **Flat vs. grouped list view** toggle (`prefs.txView`). Activity is always
  grouped by date now.
- **Mobile filter sheet** (`filtersOpen` bottom sheet: period / type / tag / view /
  import / select). Mobile now wraps the same search + segmented + month pill +
  Select controls inline.
- **Keyboard-shortcut hint badge** ("⌨ N") in the header. The `n` shortcut still
  works.
- **`TransactionRow` always-visible action icons** (Edit / Split / Save template /
  Delete on ≥sm) collapsed to a single ⋯ menu on every breakpoint. The mobile ⋯
  is a dropdown menu, **not a bottom sheet** (the mockup shows a bottom sheet).
- **`TransactionRow` meta**: dropped the **subcategory** badge, the per-tag
  **`#tag`** badges, and the inline **transfer-fee** text. Category is a plain
  pill; recurring + receipt indicators kept (condensed).

**Retained beyond the mockup:** the templates "Quick add" strip (the handoff
doesn't show it) so the row's "Save as template" action still has a consumer.

---

## Phase 7 — Budgets & Goals

File: `src/pages/BudgetsPage.tsx` — mostly a **restyle** (the handoff keeps all
three tabs and every modal). Goal cards, the history table, and all modals inherit
the new primitive + token styling with no structural change.

**Removed / changed on the budget card:**

- Separate Edit + Delete icon buttons consolidated into one ⋯ menu.
- The detailed rollover breakdown box (Base budget / Rollover surplus rows)
  replaced with a single "+$X rolled in" line (per the mockup).
- The explicit "Effective: $X" / "Budget: $X" line and the "View covered
  transactions" hint line removed. The whole card is still clickable to open the
  covered-transactions dialog.
- "Warning" threshold badge now uses `--gold`; rollover badge uses `--transfer`.
- Tabs restyled to a `w-fit` surface-container pill (was a full-width 3-col grid).
- `CycleStepper` kept on desktop Budgets even though the mockup shows no month
  control (period selection has to come from somewhere).

---

## Phase 8 — Reports

File: `src/pages/ReportsPage.tsx` — targeted restyle; date-range presets, saved
presets, mobile controls, charts, account-balances list, recent-in-period list,
and the Analytics tab keep their behaviour and inherit the new styling.

**Changed:**

- The two separate **CSV** / **PDF** export buttons → one **Export** button with a
  CSV / PDF dropdown menu (per the mockup).
- `StatCard`: dropped the decorative blurred colour blob; flatter card
  (`rounded-[18px]`, no border, `--el1`); icon tile is a plain tinted square; the
  delta/sub line is tinted with the card's semantic colour instead of muted grey.
- Tabs restyled to a surface-container pill; the `h-7` / `text-xs` trigger sizing
  dropped for the standard pill size.

---

## Phase 9 — Settings

File: `src/pages/SettingsPage.tsx`.

**No feature loss** — all 7 sections (Profile, Appearance, Preferences,
Notifications, Month Cycle, Legal, Account), every control, and the "type DELETE"
confirmation dialog are unchanged.

**Structural changes:**

- Layout is now a **section rail + single content column** (was a 2-column card
  grid on `lg`). Desktop rail shows labels with a scroll-spy active pill;
  tablet (`md`–`lg`) shows an icon-only rail; mobile has no rail (continuous
  scroll). `IntersectionObserver` drives the active-section highlight;
  clicking a rail item smooth-scrolls to that `<section id>`.
- Each section now has an **outside `<h2>` + description**; the in-card
  `CardHeader` / `CardTitle` / `CardDescription` were removed (their text moved to
  the section heading). Icons moved from the card titles to the rail.
- The unused `.settings-grid` rules remain in `index.css` (harmless).

---

## Phase 10 — Transaction modals

Files: `src/components/transactions/TransactionForm.tsx`.

**No feature loss.** `TransactionForm` already had a collapsible "More details"
section (Notes / Tags / Goal / Recurring / Receipt) and `QuickEntry` (mobile) is
already an amount-first keypad; `TransactionKindMenu` already renders
icon + label + description rows.

**Changed:**

- Amount + currency moved to a prominent **bordered "AMOUNT" block at the top**
  (was a plain 2-col grid after Account/Category). The amount is now a large
  borderless number field (`$` prefix, 36px, tinted with the kind's semantic
  colour) using `inputMode="decimal"` — the `type="number"` spinner is gone.
  Currency is a pill `Select`.
- "More details" toggle restyled to a surface-container card with a primary
  "Add / Review / Hide" affordance (no behaviour change).
- The kind menu remains a dropdown (not a bottom sheet on mobile), consistent
  with the Phase 6 row menu.

---

## Phase 11 — Verification

No code changes beyond docs. `npm run build`, `npm run lint`, and
`npm run test:redesign` all pass on the final tree. `docs/M3_REDESIGN.md` rewritten
for the blue/indigo system.

## Cross-cutting items to revisit

- **Categories page** has no desktop navigation entry (only mobile More sheet /
  URL). Consider re-adding it to the desktop rail or Settings.
- **Saved transaction templates** can be created (row menu) and used (Activity
  "Quick add" strip, kept beyond the mockup) but there's no dedicated
  management surface.
- **Dashboard widgets** (upcoming bills, category pie, budget progress, cash-flow
  forecast, spending alerts) and their component files are unreferenced but still
  on disk — delete or re-surface.
- **Import CSV** dialog is on disk but unreachable.
- Mobile row-action and add-transaction-kind menus are dropdowns, not the
  bottom sheets the mockups show.
