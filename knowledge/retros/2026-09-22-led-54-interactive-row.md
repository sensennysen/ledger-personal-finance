# LED-54 — One row component for clickable rows

## Pattern
The ticket's own file:line citations (`DashboardCategoryPieCard:29`, `BudgetsPage:1090`, `TransactionsPage:481`, `TransactionRow:177`) were stale by the time this was picked up — three of the four hand-rolled `role="button"/tabIndex={0}` rows had already been patched with their own `onKeyDown` independently, and `TransactionRow.tsx` no longer has a `tabIndex` row at all (its primary click target is already a real `<button>`, so it wasn't touched). The actual remaining work was de-duplication, not a keyboard-accessibility bug fix: four copies of the same role/tabIndex/onKeyDown boilerplate, one shared implementation.

`src/components/ui/interactive-row.tsx` (`InteractiveRow`) is polymorphic via `as` (default `'button'`). Two of the five rows (`BudgetsPage`'s budget card, `TransactionsPage`'s template chip) contain their own nested interactive controls (Edit/Delete buttons, a Remove-template button) — wrapping those in a literal `<button>` is invalid HTML and breaks the nested controls' own click handlers, so those two use `as={Card}` / `as="div"` and get `role="button" tabIndex={0}` plus the same centralized `onKeyDown`, guarded by `event.target === event.currentTarget` so the nested button's own Enter/Space doesn't double-fire the row.

## Decisions
- Kept AC's "button-based" as the *default*, not a hard requirement on every row — the two rows with nested interactive children physically can't be a `<button>` element. All five still share the one component and one keyboard-handling implementation, which is what the AC is actually protecting against (four copies drifting out of sync).
- `TransactionRow.tsx` was left alone — it no longer matches the ticket's description, and touching it would be an unrelated change (AGENTS.md: no unrelated refactors).
- Ring-width unification (spec §5.12 point 7, `ring-2` vs `ring-3`) was explicitly left out of scope — that's LED-56's motion/ring-token pass. Existing `ring-2`/`ring-ring` classNames were carried over unchanged.

## Acceptance
- One shared row component fixes all five: PASS. `interactive-row.tsx` created; `DashboardCategoryPieCard`, `DashboardTransactionRow`, `BudgetsPage`, `TransactionsPage` all adopted it; `graphify query` confirms all four reference it with no unexpected community crossings.
- Every focusable row is operable by keyboard: PASS.
  - `DashboardCategoryPieCard` (`as="button"`) — seen live: tabbed to the "Expenses by Category" card on the dashboard, focus ring wrapped the whole card, Enter opened the detail panel.
  - `DashboardTransactionRow` (`as="button"`, conditional on `onClick`) — PASS by code only; same `as="button"` path as the verified card above, but no transactions existed in the test account to render an actual row.
  - `BudgetsPage` budget card (`as={Card}`) — PASS by code only; account had zero budgets ("No budgets yet"), didn't create one to avoid mutating the user's real data (same call as the LED-50 retro made for `BudgetHistoryCard`).
  - `TransactionsPage` template chip (`as="div"`) — PASS by code only; account had zero saved templates, so the strip never rendered.
- `pnpm exec tsc -b`, `pnpm lint`, `pnpm build`, `pnpm test` (126/126 + `redesign.mjs`): PASS.

## Backlog
- `DashboardTransactionRow`, the `BudgetsPage` card, and the `TransactionsPage` template chip were not seen rendered/keyboard-tested live — needs an account with transactions, a budget, and a saved template to confirm visually. Risk is low: same component, same code path already verified on `DashboardCategoryPieCard`.
- Ring-width inconsistency (`ring-2` on hand-rolled rows vs `ring-3` on primitives, spec §5.12 point 7) untouched — belongs to LED-56.
