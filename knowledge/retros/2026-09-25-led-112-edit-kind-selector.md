# LED-112 · Edit mode Kind selector that clears fields that no longer apply — retro (2026-09-25)

## What shipped
- Editing a saved expense, income or transfer shows **Kind** as the form's first control, set to the row's type. Changing it runs `applyKindChange` (LED-111) through `form.reset`, so category, subcategory, destination and fee are cleared for the new kind rather than rejected on submit.
- `TransactionEditHeader` titles the edit dialogs. A saved loan repayment or card payment reads "Edit loan repayment" / "Edit card payment" with the design caption and a tile, and has no selector; a plain entry reads "Edit transaction" (was "Edit Transaction").
- `canChangeSavedKind(target)` in `src/lib/editTarget.ts` decides who gets the selector: targets `none` and `other` only.

## Decisions
- **No selector while the target is `pending` or `missing`.** A saved payment whose target account is not loaded (or not visible) is shown as a plain expense with its target kept; changing its kind would drop that target silently.
- **The Kind select offers expense, income and transfer only**, as the ticket says.
- **Cross-currency: not built, and the ticket's premise was wrong.** It says a transfer between currencies must "ask for the rate through the existing exchange-rate field". `TransactionForm` has no such field: `exchange_rate` is only defaulted to 1 (line 104) and nothing edits it. A transfer created today between USD and EUR accounts already saves at rate 1. Editing to a transfer now behaves exactly like creating one. A rate control is LED-136 (OD-3, blocked).
- The edit dialogs keep `max-w-md`, including for a saved card payment.

## Acceptance criteria
- (a) Editing an expense shows Kind set to Expense: PASS (browser).
- (b) Expense to transfer clears category and subcategory and asks for a destination with no submit-time error: PASS for the clearing and the destination prompt (browser; saved with Savings as the destination: the row is a transfer, `category_id` null, `to_account_id` set, Savings balance +86.40 and Checking unchanged, so the update triggers reversed and re-applied correctly). **NOT MET** for the cross-currency clause (no rate field, above).
- (c) Transfer to expense clears `to_account_id`: PASS in unit tests (every ordered pair); not exercised in the browser.
- (d) A saved loan repayment shows no selector and states its kind in the title: PASS (browser: "Edit loan repayment", no Kind). A saved card payment: PASS in code only. A card payment cannot be saved at all today (see LED-113 retro), so there was no row to open.
- (e) `applyKindChange` tested for every pair of income, expense and transfer: PASS (`tests/transactionKindChange.test.mjs`).
- (f) A saved row still infers its kind after a change: PASS (unit test through `inferTransactionKind`).
- (g) Lint, build and test: PASS.

## Backlog
- Add a rate field for cross-currency transfers (LED-136) and then let edit ask for it.
- `other` targets (an expense pointing at a non-liability account, which the database trigger now forbids) get the selector; not exercised.
- Not checked at 390 or in the light theme.
- The edit submit label for a loan repayment still reads "Record Payment".
