# LED-80 · Actions and content on the detail view — retro (2026-09-24)

## What shipped
- `EntryContext` now takes `(tx, actions?: EntryActions)`, where `EntryActions` is `{ onEdit, onDelete, onSplit }`. `TransactionRow` passes all three (Split only for non-transfers and only when the page offers it, which today means Activity only). Dashboard and search pass none, as before.
- `EntryDetail`:
  - Actions are Edit, then Split and Delete. Each shows only when passed, and each closes detail first. Delete goes through the page's `handleDelete` and the existing `UndoToast`, following the LED-80/LED-93 note in the build order.
  - Transfers and loan repayments show one "From → To" row.
  - The date goes through `formatDate`.
  - Tags show as `#tag` chips.
  - The receipt shows as "View receipt", resolved on click with `resolveReceiptUrl`. A pending upload says so, and a failure shows an inline alert.
  - Budget impact: `BudgetImpactBar` mounts only for categorised expenses. It reads `useBudgets` for the cycle the entry falls in (`monthKeyOf`) and shows this entry's share inside the category's spent/allowance bar.
- `src/lib/budgetImpact.ts`: `entryBudgetImpact(tx, budget, range)` (pure, 8 tests). It uses the same currency conversion as `sumBudgetSpend`, and returns null rather than guess for an unrated currency, a date outside the budget range, or a zero allowance.

## Acceptance
- Delete and Split actions present: PASS.
- Transfers render as from → to: PASS.
- Budget impact, tags and receipt shown: PASS in code. Budget impact is unit-tested.
- Date formatted, not raw ISO: PASS.
- Lint, build and test pass.

## Backlog
- Not verified live (Google OAuth sign-in). Unconfirmed: the bar's look, the receipt opening in a new tab, and Delete → undo from the detail view.
- On first open, `BudgetImpactBar` triggers the 13-month budget read when that cycle isn't cached. The bar stays hidden until the read finishes. Consider a smaller read if it feels slow.
- `handleDelete` logs delete errors to the console and doesn't show them (existing behaviour, not new). LED-92/LED-93 cover it.
- Account detail rows get Delete but not Split, because that page never offered Split.
