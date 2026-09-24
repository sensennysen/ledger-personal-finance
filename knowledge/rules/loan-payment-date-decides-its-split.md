# A loan repayment's date decides how it is split
`allocate_loan_payment` first splits a repayment by what is *due on the transaction's date* (`loan_purchase_due_amount(p, new.date)`). Only what's left over is split by each purchase's remaining balance.
**Why:** a payment dated before its deadline has nothing due yet, so it gets the remaining-balance split. The schedule then shows the deadline as partly unpaid (LED-83: $488/$132 instead of $480/$140).
**How:** any flow that pays a specific deadline dates the transaction on that deadline's due date (see `handleRecordPayment` in `AccountTransactionsPage`). Never show a per-purchase split for a payment without saying which date it assumes.
