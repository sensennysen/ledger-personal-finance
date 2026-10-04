# LED-131 · Unitemised loan debt: add it as a purchase, atomically — retro (2026-09-25)

## What shipped
- `supabase/migrations/20260925110100_add_unitemised_purchase_rpc.sql`: `add_unitemised_purchase(p_account_id uuid, p_purchase jsonb) returns loan_purchases`, `SECURITY INVOKER`. Under a lock on the account row it computes owed (`max(0, -balance)`) and itemised (what is left to pay on each purchase), raises if the gap is not above zero, inserts the purchase for the account's owner, then adds the gap back onto the balance.
- The reconciliation band offers **Add it as a purchase** (gap above zero, online). It opens `LoanPurchaseForm` with the gap as principal, 0% interest and a name, and a note that the loan amount comes down as the purchase goes on.
- `useLoanPurchases.createUnitemizedPurchase` calls the rpc and does not refetch. The tracker holds `settling` from submit until `Promise.all([refetch(), onAccountChanged()])` resolves, and the band cannot show while it is set. `onAccountChanged` is now `() => void | Promise<void>`. The normal Add Purchase path uses the same guard.
- `loanSummary.ts`: `unitemisedPrefill`, `unitemisedLoanContext` (the form's "after adding" starts from owed minus the gap). Tested.

## Decisions
- **The function lowers the balance by the gap, not by the purchase's remaining balance.** After the insert trigger the loan owes `owed + remaining`; taking the old gap off leaves `itemised + remaining`, so the gap is exactly zero for any rate, term or opening progress. Interest becomes real extra debt, which the dialog note says. Lowering by the remaining instead would leave a gap whenever the purchase carries interest.
- **The gap is computed on the server.** A stale client cannot lower the balance by a gap that already closed (checked: a second call raises "no unitemised balance").
- Argument names are `p_account_id` / `p_purchase`, not the ticket's `account_id` / `purchase`, to avoid clashing with column names inside the function.

## Acceptance criteria
- (a) The band offers "Add it as a purchase" with the gap prefilled: PASS live (owed 8,940, itemised 8,540: form opened with 400).
- (b) One rpc creates the purchase and lowers the balance; the figures agree and the band disappears: PASS live. rpc returned 200, the loan stayed at 8,940 (0% purchase), purchases summed to 8,940, band gone. In psql, with 2.5% interest (4 x 110) and with opening progress, owed still equalled itemised.
- (c) A failed write changes nothing: PASS in psql. A category that does not exist raised, and the balance and purchase count were unchanged. Not forced from the browser.
- (d) No false-gap flash after creation: PARTIAL. Adding a normal purchase live (owed rose 300 to 9,240) showed no reconciliation band at any point after submit. The behaviour without the guard was not measured, so this shows the flash is absent, not that the fix is what removed it.
- (e) Migration applies to an empty database: PARTIAL, same as LED-130 (applied locally, lint clean, from-scratch replay left to CI).
- (f) Lint, build and test pass: PASS (541/541).

## Backlog
- From-scratch replay not run locally (see LED-130).
- The flash guard was not compared against the unguarded code. To do that, remove `!settling` from `showReconciliation` and repeat the normal Add Purchase with a MutationObserver armed after submit.
- Edit and delete of a purchase still call `onAccountChanged()` without waiting, so they can flash a false gap the same way. Only create was in scope.
- With a term that does not divide the gap (400 over 3 months = 133.33 x 3 = 399.99) the preview and the saved total are 1 cent short of the gap; the rpc still closes the gap because it lowers by the computed gap, and the loan ends 1 cent under the old amount. Worth a rounding note in the form.
- Offline the band button is disabled and the tracker already explains why; the refusal message in the hook was not reached.
