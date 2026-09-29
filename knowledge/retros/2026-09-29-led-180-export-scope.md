# LED-180 · Export/deletion scope (OD-7) — retro (2026-09-29)

## What shipped (first pass)
- `src/lib/dataExport.ts`: `buildSavingsGoalsCsv`, `buildLoanPurchasesCsv`, `buildLoanAllocationsCsv`, `buildTransactionRulesCsv`, plus a "Loan Due Days" column on `buildAccountsCsv` (raw `loan_due_days`/`loan_due_weekday`, reusing `WEEKDAY_LABELS` from `loans.ts`).
- `src/components/legal/ExportDataCard.tsx`: wired the four new builders to `useSavingsGoals()`, `useLoanPurchases()` and `useTransactionRules(true)` — all three already fetch "everything for this user" with no args, so no new hook was needed. Added a note under the export list naming the three tables still not downloadable (see Backlog).
- `src/pages/DataDeletionPage.tsx`: the "Data we hold" list and the deletion paragraph now name every table, including the three not yet exportable — verified against `delete_user()` (`supabase/schema.sql`), which deletes `auth.users` and cascades through every FK to `profiles(id)`, so the copy's "erased in a single operation" claim is accurate for all of them.
- `tests/dataExport.test.mjs`: one test per new builder plus the loan-due-days column.

## What shipped (phase 6 follow-up, same day)
- `src/lib/dataExport.ts`: `buildSubcategoriesCsv`, `buildCreditCardPaymentsCsv`, `buildExchangeRatesCsv` — the three builders the first pass deferred.
- `src/hooks/useSubcategories.ts`: `useAllSubcategories()` **already existed** (added long before this epic, zero callers) and is exactly the "every subcategory for this user" read the first pass said didn't exist — it only checked `useSubcategories(categoryId)`, the per-category hook, and missed its sibling in the same file. Added error tracking (`describeDataError`) to it, since it had none and the export card needs a real error state, not an empty one, per AGENTS.md. `knowledge/patterns/hooks-on-public-pages.md` point 5 corrected to name the right hook.
- `src/hooks/useCreditCardPayments.ts` (new): a plain "every payment for this user" read, following the `useSavingsGoals.ts` shape (useAuth + supabase only, no provider). `useCardPayment.ts` inserts/updates one payment via `useNotify`/`useAccounts` and isn't public-page-safe; this is a separate, minimal hook.
- `src/hooks/useExchangeRateRow.ts` (new) + `exchangeRateRows()` in `src/lib/exchangeRates.ts`: reads the user's one `exchange_rates` row directly (same `.maybeSingle()` read as `ExchangeRatesContext`, no `ExchangeRatesProvider`, which needs `useAccounts` — the exact LED-136 trap the pattern doc already warns about). `exchangeRateRows()` flattens `rates`/`overrides` into one row per currency, base at 1, override winning over feed.
- `src/components/legal/ExportDataCard.tsx`: wired all three in; removed the "not downloadable yet" note, since all 7 tables are now covered.
- `tests/dataExport.test.mjs`, `tests/exchangeRates.test.mjs`: one test per new builder/helper.
- **Live-verified** in a real browser this time: local Supabase + a throwaway test user (created and deleted via the admin API, seeded one subcategory/card account/payment/exchange-rates row via `psql`, deleted after) driven headlessly over CDP per `knowledge/patterns/browser-check-with-local-user.md`. All 11 export buttons rendered with a correct count; clicked Accounts, Categories, Subcategories, Credit card payments and Exchange rates (the others had nothing seeded) and read back the actual downloaded CSV text — rows matched exactly, including the override (56.5) correctly beating the feed rate (56.2) for PHP.
- **Route correction**: the deletion page is `/data-deletion`, not `/legal/delete-account` as first assumed when planning the live check — cost one debugging round (blank `#root`, no console errors, right up until checking `App.tsx`'s route table directly).

## Acceptance
- "every table with user data has a CSV or a stated reason": **PASS**. All 7 tables (savings goals, loan purchases, loan allocations, transaction rules, subcategories, credit card payments, exchange rates) now have a CSV.
- "the page list matches": **PASS** — `DataDeletionPage.tsx`'s list already named all 7 from the first pass; verified unchanged.
- "tests for each builder": **PASS**, all 7.
- "the export still names files with the local date": **PASS**, unchanged `exportFileName(kind, localDate)` pattern.
- Lint, `tsc -b`, `pnpm build`, full test suite (765 tests): PASS.
- Live browser check: **PASS** (see above) — closes the "not verified live" backlog item from the first pass.

## Backlog
- None open for LED-180 itself. `knowledge/patterns/hooks-on-public-pages.md` now flags checking for an existing "read everything" hook (not just the obvious per-entity one) before concluding a new query is needed — this cost a wasted "no hook exists" conclusion in the first pass.
