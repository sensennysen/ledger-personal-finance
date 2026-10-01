# LED-50 — EmptyState action slot, then adopt it

## Pattern
`ui/empty-state.tsx` grew two optional props, `action?: ReactNode` and `bare?: boolean`, not just the one the AC named. All 8 adoption sites sit inside a container that already has its own card/dialog chrome (a `Card`, a manually-styled bordered `div`, or a `DialogContent`) — wrapping them in `EmptyState`'s default `Card` (`py-16`, border, `bg-card`) would nest a card inside a card. `bare` skips that wrapper and renders `icon`/`title`/`description`/`action` in a plain `text-center py-8` div instead; the 3 pre-existing consumers (`AccountsPage`, `TransactionsPage`, `AccountTransactionsPage`) keep the old `Card`-wrapped, `py-16` output because `bare` defaults to `false`. `description` was also made optional (`description?: string`) so sites with a single-line message (6 of the 8) don't render an empty `<p>`.

## Decisions
- `DashboardDetailDialogs`' shared `TransactionListDialog` took a new `emptyIcon: LucideIcon` prop, threaded per caller: `TrendingUp` for the income dialog, `TrendingDown` for expenses — reusing the icon convention `ReportsPage` already uses for income/expense stat cards.
- Icon choices elsewhere reused whatever was already imported in that file where possible: `Wallet` (accounts, matches `AccountsPage`'s own `EmptyState`), `PieChart` (category breakdown dialog), `History` (`BudgetsPage`, already imported for a different block), `TrendingDown`/`Store` (`ReportsPage`'s two sites — `Store` fits "by merchant" well and was already imported, no new import needed).
- `ReportsPage` has 3 bare-`<p>` candidates but the AC caps it at ×2. Picked the two period/expense-breakdown ones (`TrendingDown` "No expenses in this period", `Store` "No expense transactions in this period") and left `AccountBalances`' "No accounts" (L715) untouched — it's an account-filter state, not a first-run/no-data one. Flagged this pick during `/plan` before implementing.
- No `action` content was added at any of the 8 sites — the AC only requires the slot to exist and the component to be adopted, not that every site gets a button. Kept the change a pure markup swap to stay in scope; wiring real CTAs (e.g. "Add account" from the dashboard dialog) would cross into §4.3's first-run work, which is explicitly out of scope for LED-50.

## Acceptance
- `action?: ReactNode` slot added to `EmptyState`: PASS.
- Adopted in `DashboardRecentTransactionsCard`: PASS, seen rendered (empty account, dashboard "Recent Transactions" card).
- Adopted in `DashboardDetailDialogs` (×3 — balance/accounts, income, expenses, categories = the 3 code sites, 4 dialogs since income/expenses share one): PASS, all seen rendered.
- Adopted in `BudgetsPage`: PASS by code only. `BudgetHistoryCard` only renders once a budget exists with `history.length === 0`; the verification account had zero budgets, and creating one just to check this render felt like an unnecessary mutation of the user's real local data. The markup is identical in shape to the 4 sites that did render correctly (same `EmptyState … bare` call), so risk is low, but it's unverified in the browser.
- Adopted in `ReportsPage` (×2): PASS, both seen rendered.
- Adopted in `ThirteenthMonthPage`: PASS, seen rendered.
- `pnpm lint`, `pnpm build`, `pnpm test` (126/126 + `redesign.mjs`): PASS.

## Backlog
- `BudgetsPage`'s `BudgetHistoryCard` empty state not seen rendered — needs a budget with zero monthly history entries in a real or seeded account to confirm visually.
- `ReportsPage`'s `AccountBalances` "No accounts" (L715) was deliberately left as a bare `<p>` — revisit if a future ticket wants it consistent with the other two `ReportsPage` sites.
- No `action` content wired at any of the 8 sites yet — first natural follow-up (e.g. "Add account" / "Add transaction" CTAs) belongs to §4.3 (first-run checklist) or a future ticket, not LED-50.
