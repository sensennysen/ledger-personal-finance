# LED-180 · Export/deletion scope (OD-7) — retro (2026-09-29)

## What shipped
- `src/lib/dataExport.ts`: `buildSavingsGoalsCsv`, `buildLoanPurchasesCsv`, `buildLoanAllocationsCsv`, `buildTransactionRulesCsv`, plus a "Loan Due Days" column on `buildAccountsCsv` (raw `loan_due_days`/`loan_due_weekday`, reusing `WEEKDAY_LABELS` from `loans.ts`).
- `src/components/legal/ExportDataCard.tsx`: wired the four new builders to `useSavingsGoals()`, `useLoanPurchases()` and `useTransactionRules(true)` — all three already fetch "everything for this user" with no args, so no new hook was needed. Added a note under the export list naming the three tables still not downloadable (see Backlog).
- `src/pages/DataDeletionPage.tsx`: the "Data we hold" list and the deletion paragraph now name every table, including the three not yet exportable — verified against `delete_user()` (`supabase/schema.sql`), which deletes `auth.users` and cascades through every FK to `profiles(id)`, so the copy's "erased in a single operation" claim is accurate for all of them.
- `tests/dataExport.test.mjs`: one test per new builder plus the loan-due-days column.

## Acceptance
- "every table with user data has a CSV or a stated reason": **PARTIAL**. 4 of 7 new tables got a CSV (savings goals, loan purchases, loan allocations, transaction rules). The other 3 — `credit_card_payments`, `subcategories`, `exchange_rates` — have a stated reason (no existing "read everything for this user" hook; building one is a bigger, more deliberate change than wiring an existing hook, and this was flagged mid-apply rather than rushed) but no CSV yet.
- "the page list matches": **PASS**, but only after a fix found in `/validate` — the first pass listed all 7 tables on `DataDeletionPage` while only 4 were downloadable, which would have read as a broken button to a user. Fixed with a one-line note on the export card (`a0526c4`).
- "tests for each builder": **PASS** for the 4 shipped; N/A for the 3 not built.
- "the export still names files with the local date": **PASS**, unchanged `exportFileName(kind, localDate)` pattern.
- Lint, `tsc -b`, `pnpm build`, full test suite (763 tests): PASS.

## Backlog
- Build a public-page-safe read for `credit_card_payments`, `subcategories` (currently only fetched per-category via `useSubcategories(categoryId)`, not "all for user") and `exchange_rates` (one row per user, `rates`/`overrides` as jsonb — needs flattening to a CSV row per currency), then add their builders and export rows. Until then the export card's note is the stated reason.
- Not verified live in a browser this session (no `claude-in-chrome` tab used) — the CSV builders are unit-tested, but the actual download buttons on `/legal/delete-account` were not clicked.
