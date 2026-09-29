# Save a flow once against the real database before calling it done
A form that renders correctly at every size has not been shown to save.
**Why:** the card payment flow (LED-24) passed lint, build, unit tests and three layout checks. Saving it in the browser during LED-113 failed twice: the form schema demanded a category ("...for this loan repayment"), and the database trigger `enforce_loan_repayment_destination` rejects an expense whose destination is not a loan. The LED-24 retro had listed "not verified in a browser"; nothing then made someone do it.
**How:**
1. For any flow that writes, submit it once in the browser with the local test user (`patterns/browser-check-with-local-user.md`) and read the row back with psql: type, destination, category, and the account balances that the triggers moved.
2. When a form reuses a field for a second meaning (here `to_account_id`, first only a loan, then a card), grep the schema's `superRefine` and the database triggers for the old meaning before trusting the form.
3. Insert the same row shape directly with psql. A trigger error shows the constraint in one step, without clicking through the form.
4. Put "saved a row end to end: yes/no" in the retro's acceptance list, separate from "renders".
