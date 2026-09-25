# LED-106 · Repayment summary band and amount presets — retro (2026-09-25)

## What shipped
- `RepaymentAssist` (`src/components/transactions/RepaymentAssist.tsx`), rendered under "Loan to repay" with `key={loan.id}` so it never shows another loan's purchases. It reads that loan's purchases once.
- A `StatsBand` component now holds the three-figure band. The card payment form uses it too, with the same markup.
- Outstanding, Installment due (amount, date, "in N days" or "N days overdue") and After this payment with the installment count ("0 of 18 → 2 of 18 paid"), from `summariseRepayment`. Over-payment shows the existing message "Payment cannot exceed the outstanding loan amount" in the band and no negative figure.
- Presets from `getRepaymentPresets`: Installment (default when a deadline is due this cycle and the amount is still empty), Pay in full (`roundMoney` of the balance), Custom (focuses the amount). The active preset is derived from the amount, not stored.
- `exceedsOutstanding` compares to the cent and replaces `amount > getLoanAmountOwed(...)` in submit validation. A balance held as a float (0.29999999999999993) no longer rejects its own rounded "Pay in full". Messages are unchanged.
- Hidden when editing (the balance already includes the edited payment).

## Acceptance criteria
- (a) Three figures render and update as the amount is typed: PASS (browser; changing the amount moved After this payment).
- (b) Installment due shows amount, date and days, and a reason when there is none: PASS (browser: "Sep 15 · 10 days overdue"; "None due this cycle" for the phone loan).
- (c) After this payment is never negative: PASS (browser: 4680.01 shows "—" and the over-outstanding message).
- (d) Installment default, otherwise Custom with an empty amount: PASS. The field shows the form's usual "0" rather than blank.
- (e) Pay in full equals the outstanding amount and saves: PASS. Cent-boundary unit test, and browser: 4680 gave a balance after of $0.00.
- (f) `summariseRepayment` tested for deadline, no deadline, over-payment, pay in full: PASS.
- (g) Existing validation messages unchanged: PASS by code.
- (h) Lint, build, test: PASS (465/465).

## Backlog
- "Current cycle" is my reading of the ticket: due on or before the end of the budget cycle, overdue included. Confirm with the product owner.
- The amount field still shows "0" when empty (existing behaviour).
- With two loans the band sits above the amount field, a screen away on a phone.
