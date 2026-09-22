# LED-55 — `<FormError>` shared component

## Pattern
The ticket's own counts were stale by the time this was picked up: the description cites "nine copies" of `text-sm text-destructive px-1 -mt-2` across three pages, but the actual codebase had grown to 13 (`AccountsPage` and `TransactionsPage` had since picked up the same hack, undercounted in the spec). The acceptance criteria's "~20 others are unannounced" turned out to be closer to the mark once every inline form-error paragraph/span in the app was counted, not just the `-mt-2` ones.

`src/components/ui/form-error.tsx` (`FormError`) is a standalone `<p role="alert">`, not tied to react-hook-form — it takes `children` and returns `null` when falsy (same null-guard idiom as `ui/form.tsx`'s `FormMessage`), and bakes in `text-sm text-destructive px-1 -mt-2` as its default via `cn()`, overridable through `className`.

## Decisions
- LoanPurchaseTracker's 4 pre-existing `role="alert"` paragraphs were migrated onto `FormError` too (user's call) — true single-component consistency per the ticket's "Single component" wording, even though they weren't in the ticket's own file list and didn't have the `-mt-2` hack.
- Discovered during `/apply` (not in the plan): `SettingsPage.tsx`'s `deficitError` had the identical unmigrated pattern — added with user approval.
- Discovered during `/validate`: 6 more inline errors existed that weren't `role="alert"`-announced and weren't caught by the plan's exact-string grep (`CategoriesPage.tsx` rename/add-subcategory errors, `SettingsPage.tsx`'s react-hook-form root error and delete-account confirmation error, `TransactionReceiptField.tsx`, `SplitTransactionDialog.tsx`). Two of these (`CategoriesPage`'s inline rename span, `SettingsPage`'s react-hook-form root error) are inline `<span>`s living in a flex row next to buttons — forcing `FormError`'s block `<p>` and default `-mt-2` there would visually misplace them, so they got `role="alert"` added directly instead. One (`SettingsPage`'s delete-confirmation error) is nested *inside* `AlertDialogDescription`, which itself renders a `<p>` — nesting `FormError`'s `<p>` there would produce invalid `<p><p>` HTML, so it also kept its `<span>` and got `role="alert"` added directly. The remaining 3 (`CategoriesPage`'s add-subcategory error, `TransactionReceiptField`, `SplitTransactionDialog`) were standalone block-level paragraphs with no such conflict and were migrated to `FormError` with `className` overrides to preserve their original spacing/size.
- "Single component" was read as "one component for the structurally uniform case" (a standalone paragraph under a stacked field/dialog), not "force every text-destructive span in the app through identical markup" — three sites keep a plain `<span role="alert">` because `FormError`'s `<p>` genuinely doesn't fit there (nesting or inline-flex layout).

## Acceptance
- Single component: PASS. `form-error.tsx` created; 18 sites across 7 files (`AccountsPage`, `CategoriesPage`, `BudgetsPage`, `TransactionsPage`, `AccountTransactionsPage`, `LoanPurchaseTracker`, `SettingsPage`) now render through it, replacing every standalone `text-sm text-destructive [px-1 -mt-2]` `<p>`.
- `role="alert"` on every inline error: PASS. The 3 structurally incompatible sites (`CategoriesPage` inline rename, `SettingsPage` root error, `SettingsPage` delete-confirmation error) got `role="alert"` added directly rather than adopting `FormError`, for the HTML-nesting/layout reasons above.
- `pnpm lint`, `pnpm build` (tsc -b + vite build), `pnpm test` (126/126 + `redesign.mjs`): PASS.
- `graphify query` on `FormError`/consumer files: no unexpected community-boundary crossings — it sits as a plain leaf `ui/` import in each consumer, same shape as `InlineLoadError`.

## Backlog
- Not visually verified in a browser this session (no dev server run) — the `className` overrides on the 3 migrated non-`-mt-2` sites (`CategoriesPage` add-subcategory, `TransactionReceiptField`, `SplitTransactionDialog`) rely on `tailwind-merge` resolving `text-xs`/`px-0`/`mt-0` correctly against `FormError`'s `text-sm px-1 -mt-2` default; worth a quick look next time those screens are open.
- No test coverage exists (or was added) asserting `role="alert"` is present on error paragraphs — `tests/redesign.mjs` doesn't currently check this pattern.
