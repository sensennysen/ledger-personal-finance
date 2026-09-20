# LED-04 — One account schema, one form

- `AccountForm` + `accountSchema` now live in `src/components/accounts/AccountForm.tsx` / `src/lib/accountSchema.ts`; both pages use them. Edit is `<AccountForm account={...} />`, which derives defaults and `originalBalance`.
- Side effects of the merge (intended): the detail-page edit now shows the loan schedule fields and the Balance Adjustment warning; the Accounts-page edit now gets the 30 / 3 defaults for utilization target and reminder days.
- Constraint: `node --test` can't resolve the `@/` alias, so anything under test must import only relative/pure modules. That is why the schema is its own file and `accountToFormValues` (in the component) is untested.

## Backlog
- Manual browser check of loan edit (Accounts page + account detail) was not run.
- A legacy loan with `loan_pay_period` set but `loan_due_days: null` now shows a validation error on edit; it was previously unfixable. Worth a look at real data.
- Move `accountToFormValues` to a pure module with relative imports so it can be tested.
- Type grid, liability-sign copy and live period fields remain LED-85.
