# LED-41 — Search empty state

## Pattern
Due-soon and loan-summary logic lives in `src/lib/globalSearch.ts` (`buildDueSoon`, `summarizeLoans`, `DESTINATIONS`), pure and structural (`DeadlineLike`), with `today` passed in so tests own the clock. `useGlobalSearch` loads loan data only while the query is empty (`useLoanPurchases(undefined, emptyQuery)`); its error and loading fold into the existing load state, so a failed loan read is an inline error, never "nothing due".

## Decisions
- Due soon = loan installments within 14 days, soonest first. Credit-card statement/due days are not included (design 16a shows a loan row only).
- "Import CSV" points to `/transactions` (same as Activity). The dialog is local state in `TransactionsPage`; no query param was added, per direction.
- Empty state hides the cycle-scope row and the Actions group (Record replaces it). E / I / T still fire only after arrowing onto a row.
- The Loan repayment row opens the existing `loan-repayment` kind; its subtitle (count, amount owed) is dropped when nothing is owed.

## Acceptance
- Four record actions: PASS by code, not seen rendered.
- Due soon from `getLoanDeadlines`: PASS (unit tested; not seen with real data).
- Jump-to all seven destinations incl. Categories and Import CSV: PARTIAL. All seven present; Import CSV only lands on Activity, it does not open the dialog.

## Backlog
- Not checked in a browser: layout, Due soon rows with real loans, Loan repayment form opening from the palette, focus after selecting a row.
- Import CSV row should open the dialog (needs a `?import=1` handler in `TransactionsPage` or a route).
- Toggling between empty and typed query refetches loans each time the query is cleared.
- "Loading…" now also waits on loans in the empty state.
- Due-soon rows link to the loan account, not the specific purchase or installment.
- LED-41 CSV status left as To Do until the browser check.
