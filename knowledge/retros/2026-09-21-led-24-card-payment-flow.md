# LED-24 — Card payment flow

## Pattern
The pure math lives in `src/lib/cardPayment.ts` (owed, available, balance after, utilisation before/after, overpayment, presets) and is tested in `tests/cardPayment.test.mjs`; `TransactionForm` only renders it. Cards never cap the amount (loans do): overpaying is a warning plus a "Pay $X instead" action, and the balance goes positive as a statement credit.

## Decisions
- One form: `TransactionForm` gained `isCardPayment` beside `isLoanRepayment`; `isLiabilityPayment` covers what both share (Pay from, locked currency, "Record Payment"). The card is resolved by the target account's type, so editing a saved card payment opens as a card payment, not a loan.
- Menu item shows only when a `credit_card` with a non-zero balance exists, no letter shortcut.
- Card account page gets a "Pay card" button (card is the locked target). From another account's menu the "Pay from" account is left unlocked so a currency mismatch cannot trap the user.
- "Minimum" has no data. A "Statement balance" chip (unpaid part of `statement_balance`) shows only when a statement balance is set.
- Repeat monthly reuses the existing Recurring toggle under More details.

## Learned
- `QuickEntry` always passes a non-empty description ("Expense"), which blocked the card description prefill. It now passes `''` for card payments. Loan repayments still get "Expense" there (not touched).

## Backlog
- Not verified in a browser: no browser in the session. The card flow at desktop, tablet and mobile, the overpayment notice, "Pay $X instead", and the Pay card button are unexercised beyond lint, build and unit tests.
- 12a layout is not matched: the card fields use the form's existing stacked layout in a `max-w-md` dialog. The 720px desktop modal, the three-cell band at tablet, and the mobile "Owed now" / "Due Oct 1 in 21d" wording are not built. This leaves the acceptance criterion "12a is built at all three sizes" PARTIAL.
- Category "Card payments" and "Excluded from spending reports" do not exist (no seed, no migration, no report filter). Card payments stay Uncategorized. Needs a migration plus report and budget changes.
- Stats band is hidden when the form opens with a prefilled amount (edit or template), since the stored balance already includes it.
- Statement and due copy shows "day N" plus days-until, not the design's dates.
- No true minimum-payment data; "Statement balance" is the closest.
- `TransactionRow.isLoanRepayment` still keys on `to_account_id` (display only, fine for cards).
- Saved-card-payment re-inference was covered by LED-08 tests; the edit path in `TransactionForm` (`editTargetType`) has no automated test.
