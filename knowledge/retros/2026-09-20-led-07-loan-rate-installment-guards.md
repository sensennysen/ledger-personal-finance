# LED-07 — Loan rate and installment guards

## Done
- `src/lib/loanRate.ts`: `monthlyRateSchema`, cap `MAX_MONTHLY_INTEREST_PCT = 10` (spec gave no number; 10 chosen, tune if needed).
- `LoanPurchaseForm.tsx`: schema uses it; rate over cap is ignored by the auto-fill; "Recalculate" link appears once the installment is hand-edited and differs from the computed value.
- `tests/loanRate.test.mjs` (`npm run test:loan`).

## Learned
- Don't put a native `max` on the rate input: the form has no `noValidate`, so the browser tooltip pre-empts the zod message.
- Setting `installmentEdited` false alone doesn't refill: the effect's deps may be unchanged, so Recalculate also sets the value directly.

## Backlog
- DB has only `check (monthly_interest_rate >= 0)`; no server-side cap (design says "schema should also cap it"). Add a `NOT VALID` check migration if wanted.
- Existing rows above 10% will show the error on edit until corrected.
- Manual browser check (type 125, edit installment, Recalculate, edit an existing purchase) not run.
