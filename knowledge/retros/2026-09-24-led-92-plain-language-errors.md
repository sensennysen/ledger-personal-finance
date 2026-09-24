# LED-92 · Plain-language error messages — retro (2026-09-24)

## What shipped (`072d09c`)
- `src/lib/dataErrors.ts` (tested, 9 cases).
  - `classifyDataError` sorts errors into connection (`08xxx`, "Failed to fetch", NetworkError), unique (`23505`), permission (`42501`, row-level security) or unknown. It reads the code first and falls back to the message, because `pagedRead` only keeps the string.
  - `describeDataError` returns `{ message, detail }`.
  - `toResult` returns a hook's `{ error, errorDetail }`, and `withDetail` turns a result into a form's error value.
- Hooks:
  - Reads keep one `loadFailure` state and derive `error` and `errorDetail` from it.
  - Mutations are typed `Promise<MutationResult>`.
  - Hooks: useAccounts, useTransactions, useCategories, useSubcategories, useSavingsGoals, useBudgets, useLoanPurchases, useTransactionRules, useOverspending, useImportDuplicates, useImportCategoryMemory, useReceiptAttachment.
- `ErrorState` shows the sentence as its description. `FormError` takes a `FormErrorValue` (a described error or the app's own string). Both show the raw text under a collapsed "Technical detail" with Copy (`ui/technical-detail.tsx`).
- Every form error keeps its detail: 21 `FormError` sites plus Settings' profile, deficit and delete errors. You chose full threading when the plan's estimate of 9 sites turned out to be 21.
- The import dialog, receipt upload and search banner no longer put raw text inside their sentences.

## Acceptance (browser, local user)
- Connection failure → plain sentence — PASS.
  - Accounts read blocked → "Couldn't load your accounts / Couldn't reach the server. Check your connection and try again.", with "TypeError: Failed to fetch" collapsed.
  - New category with the table blocked → "… Nothing was changed.", with the raw text collapsed in the dialog.
- Unique violation → plain sentence — PASS (unit tests only; see Backlog).
- RLS denial → plain sentence — PASS (unit tests only).
- Raw text stays collapsed for support — PASS. No `error.message` reaches a headline. The only remaining reads are AuthContext, which already maps through `authErrors`, a console log, the CSV parser's own copy, and LoginPage (below).

## Issues found in validate
- None in LED-92's code.
- Blocked GETs take ~8 s to fail because supabase-js retries network errors on reads, so the error state appears late. This predates LED-92. Recorded in the browser-check pattern.

## Backlog
- `categories` and `subcategories` have no unique constraint on name, so a 23505 in practice only comes from `loan_payment_allocations`. Preventing duplicate category names would need a product decision and a migration.
- RLS-denial and unique copy are unit-tested, not triggered live.
- LoginPage still renders `sessionError?.message`, left for LED-96 (Login page).
- An ~8 s wait before a connection failure shows on reads (supabase-js GET retries). Consider a shorter retry for foreground reads.
