# Epic 1 review follow-ups (LED-20 to LED-24)

## Changes
- `TransactionForm` takes an explicit `isEditing` prop. The card summary and presets are hidden only when editing (an edit's balance already includes the payment), not whenever an amount is prefilled.
- Editing a payment whose target account is not in the loaded list no longer guesses "loan repayment": the form shows a plain expense with a notice and keeps `to_account_id`. Card vs loan is decided only from the target's type.
- Switching card replaces the description only if it is empty or is exactly the one generated for the previous card (`isAutoCardPaymentDescription`); typed text is never overwritten.
- `useDeficitBehaviour` returns null until the profile loads. `useBudgets` waits, Settings disables the radios and the Overspending card shows its skeleton, so nothing is computed with a guessed `carry`. A failed profile load falls back to `carry`.
- Settings examples say "Example: a 600 budget with 742.30 spent" and "the next cycle" instead of a hard-coded month.
- Cycle boundaries live in `src/lib/cycleRange.ts` and are used by `getCustomMonthRange`, `getReportRange` and `overspending`.
- `useOverspending(until)` stops at the end of the selected cycle; later transactions cannot change that cycle's result.

## Decisions
- Removal of the Reports presets was already recorded in the LED-21 retro (localStorage key `ledger-report-presets` is orphaned by design); nothing changed.

## Backlog
- Manual browser check not run: edit a card payment and a loan repayment, edit one whose card is archived, Settings before/after profile load, stepping cycles on Reports.
- Stepping cycles on Reports now refetches the Overspending transactions.
- `isLoanRepayment` in `TransactionForm` no longer treats any edited expense with a target as a loan; templates or imports that prefill `to_account_id` outside edit rely on `entryKind`.

## Re-review fixes
- `useOverspending` exposes data only for the cycle it was loaded for, so stepping forward shows the skeleton instead of the previous cycle's transactions; it also clears `loading` when signed out.
- `useDeficitBehaviour` falls back to `carry` when offline with no cached profile, so it never waits forever.
- While accounts are still loading, an edited payment briefly renders as a plain expense before the loan/card UI appears.
