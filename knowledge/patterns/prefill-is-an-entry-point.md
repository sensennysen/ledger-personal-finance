# A prefilled form value is an entry point too
When a form tracks where a value came from (a preset, the rate feed, the user), seed that state from the form's `defaultValues` as well as from the buttons.
**Why:** LED-293 recorded "the amount came from a preset" only when a preset button ran. Pay now (Home), Make payment (loan page) and Pay card open the form with the bill's amount in `defaultValues`, so that path never ran. The unit test and the button path passed, but the case from the bug report still kept 456 as EUR. Only the live check in /validate, run from Home's Pay now as the ticket described it, caught it.
**How:**
1. List every way the form opens with a value: the preset buttons, any `useEffect` default, and each caller that passes `defaultValues` (`prefill`, `repaymentPrefill`, the card page's `cardAmountDue`).
2. Initialise the origin state from `defaultValues` for a new entry (`!isEditing`). A saved row's values are the user's own.
3. Run the live check from the same entry point the bug report used, not only from the button the fix touched.
