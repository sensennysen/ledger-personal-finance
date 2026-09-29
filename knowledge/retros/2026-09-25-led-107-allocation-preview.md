# LED-107 · Allocation preview before saving — retro (2026-09-25)

## What shipped
- `previewLoanAllocation` in `src/lib/loanRepayment.ts`: a port of `allocate_loan_payment`. It takes the form's Date. `RepaymentAssist` shows one row per unpaid purchase: name, "Installment N of M", the amount applied, the remaining balance after, and the line "How this payment is applied, as paid on {date}". It is hidden with no purchases, an empty amount, an over-payment or an invalid date.
- The installment count in the band is read off the same preview, so the two cannot disagree.

## The ticket's split description is wrong
The ticket and spec say "oldest-installment-first". The SQL is not. Phase 1 shares the payment across purchases in proportion to what each has due on the transaction date. What is left is shared in proportion to remaining balance after phase 1. `getPurchaseInstallments` supplies the due amounts and labels, but the split across purchases is a port of the SQL. The file header says so.

## Parity
Nine scenarios were run through the real trigger on the local database and the outputs are pinned in `tests/loanRepayment.test.mjs`: exact due ($300/$180), due plus extra ($410/$210), before the due date ($476.92/$143.08), cent rounding across three purchases, a second payment, opening progress, cap at the balance, staggered first due dates. The port matched all of them.

## Acceptance criteria
- (a) One row per purchase with installment N of M, amount and remaining: PASS (browser).
- (b) The split changes when the Date field crosses a due date: PASS (unit; browser $300/$180 on Sep 25 versus $476.92/$143.08 on Sep 1).
- (c) The preview equals the saved allocations: PASS for the fixtures and for a live save: a $620 payment dated Sep 1 previewed $476.92/$143.08, and `loan_payment_allocations` held exactly $476.92 and $143.08. The retro's $480/$140 and $488/$132 figures were not reproduced; the closest scenarios are above.
- (d) Hidden with no itemised purchases: PASS by code and unit test (`rows: []`). Not seen in the browser.
- (e) Reuses `getPurchaseInstallments` and `enrichLoanPurchase`; the cross-purchase split is a port, described above: PARTIAL, by necessity.
- (f) Lint, build, test: PASS (465/465).

## Backlog
- A purchase that receives nothing still shows a "$0.00" row (Sedan, when the payment is dated before its next installment). Consider dimming it.
- Rounding: `round(...)` in SQL is half away from zero on numeric; JS uses `roundMoney`. No difference appeared in nine scenarios, but a float edge near a half cent is not ruled out.
- Not checked in the browser: a loan with no itemised purchases, and a purchase with opening progress.
