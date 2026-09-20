# LED-08 — inferTransactionKind mis-types card payments

## Done
- `transactionKinds.ts`: added `'card-payment'` (label, dialog title per spec §1.3); `inferTransactionKind` takes the target account's type and returns `'card-payment'` for `credit_card` targets. Pure function of stored fields, so saved rows re-infer with no migration.
- `TransactionsPage.handleUseTemplate` looks up the target account type via `useAccounts()`.
- `tests/transactionKinds.test.mjs` (`npm run test:kinds`).

## Learned
- Unknown target type (missing or unloaded account) falls back to `'loan-repayment'`, the old behaviour.

## Backlog (LED-24)
- No menu entry, 12a layout, or `QuickEntry` fullForm path for `'card-payment'` yet.
- `AccountTransactionsPage` hard-codes `'loan-repayment'` at the pay button; not touched here.
- Widening the union broke `tsc` in `QuickEntry` and `TransactionForm` (they narrow kind to a transaction type); fixed by mapping `'card-payment'` to `'expense'` there. Loan-only behaviour (locked target, "Record Payment" label, disabled type select) is not extended to cards.
- `TransactionRow.isLoanRepayment` still uses `type === 'expense' && to_account_id` for display logic (hides category/split); left as is.
