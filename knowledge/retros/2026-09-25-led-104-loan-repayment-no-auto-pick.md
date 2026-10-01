# LED-104 · Loan repayment never auto-picks a loan — retro (2026-09-25)

README Part 1 #3, High severity. An effect in `TransactionForm` called `handleLoanChange(loanAccounts[0].id)` whenever the repayment form had no loan selected. That call also overwrites currency, source account and description, so with two or more loans the form opened pre-filled against an arbitrary debt and an unnoticed submit recorded a wrong payment.

## What shipped
- `src/lib/loanPicker.ts`: `resolveInitialLoanId(loans, lockedLoanAccountId, editTarget)`. A locked loan wins; editing a saved repayment returns null (the form already holds its own loan); otherwise only a single loan is picked; 0 or 2+ return null.
- `TransactionForm`: the effect asks the helper and only calls `handleLoanChange` when it returns an id. With 2+ loans `to_account_id` stays null, currency, account and description stay untouched, and submit shows the existing 'Choose the loan you are repaying' error.
- `tests/loanPicker.test.mjs`: 0, 1 and 2+ loans, locked, editing.
- The ticket named `src/components/TransactionForm.tsx`; the file is `src/components/transactions/TransactionForm.tsx`.

## Acceptance criteria
- (a) One loan opens selected: PASS by code and unit test.
- (b) 2+ loans open with `to_account_id` null and other fields untouched: PASS by code (the effect no longer calls `handleLoanChange`). Not seen in the browser.
- (c) A locked loan stays selected and disabled: PASS by code (unchanged default values plus helper).
- (d) Editing a saved repayment opens on its own loan: PASS by code (`selectedLoanId` is set from the row, and the helper returns null for `'loan'`).
- (e) Helper unit-tested: PASS.
- (f) Lint, build and test pass: PASS (383/383).

## Backlog
- Not verified live: open Record a loan repayment with two loans and confirm the Loan to repay select is empty and Submit shows the error.
- The card-payment effect (`cardAccounts.find(balance < 0) ?? cardAccounts[0]`) still auto-picks; it is decided in LED-113.
- Until LED-105 adds the picker step, the existing 'Loan to repay' select is the only way to choose.
