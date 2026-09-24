# LED-83 · Schedule you can scan and pay — retro (2026-09-24)

## What shipped
- `DEADLINES_PAGE_SIZE` and its prev/next nav are gone. "Payment schedule · N remaining" pins the next deadline, already expanded with each purchase's installment, above a scrolling list (`max-h-72`) of later deadlines. Each later row shows "N purchases" and still expands.
- "Record this payment" opens the page's existing loan dialog with `defaultValues` `{ amount: deadline.total, date: deadline.dueDate }` (`repaymentPrefill`, cleared on close).
- Purchase progress has two segments from `splitPurchaseProgress`: "Imported as already paid" (`bg-primary/40`) and "Paid through Ledger" (`bg-primary`). A legend shows when any purchase has opening progress. The bar is `role="img"` with both amounts in its label.
- `labelAllocationInstallments` replays each purchase's running total (opening progress, then allocations by transaction date) against installment boundaries. The split rows read "Installment 34 · Sep 15, 2026", or "Installments 11–12" for a payment that covers two.
- `daysUntilDate` is now exported from `accountsOverview.ts` for the "in N days" / "N days overdue" text.

## Decisions
- **The prefilled payment is dated on the deadline's due date, not today.** `allocate_loan_payment` splits by what is *due on the transaction date*. A payment dated before the due date falls through to a split by remaining balance ($488/$132 instead of $480/$140), which leaves the deadline partly unpaid. Paying a future deadline therefore creates a future-dated transaction until that day. The date stays editable.
- No "Show all N" button; the acceptance criteria ask for a scrolling list.
- The page's own "Next payment → Make payment" sidebar button is unchanged, as planned.

## Acceptance
- Scrolling list replaces pagination: PASS (browser, 14 deadlines, no horizontal overflow at 390/1280/1920).
- Next payment pinned and expanded, with a prefilled repayment action: PASS. The dialog opened with amount 610 and date 2026-10-15. Submitted, the payment was allocated exactly $480/$130, the pinned deadline moved to Nov 15 and no false gap appeared.
- Imported-as-paid visually distinct from repaid: PASS (browser screenshot, legend).
- Installment number in Recent Payment Splits: PASS (unit, 4 cases; browser "Installment 35 · Oct 15, 2026").

## Backlog
- The sidebar "Make payment" next to the tracker opens the repayment form **without** the prefill. Two buttons for the same deadline behave differently. Wire it to `handleRecordPayment(nextLoanDeadline)`.
- The repayment form requires an expense category, so "Record this payment" still needs one click to pick it. Existing behaviour, but the loan's purchases have categories that could default it.
- Installment labels assume payments fill in date order. A backdated payment entered after later ones renumbers the later rows. That's correct by date, but may surprise.
