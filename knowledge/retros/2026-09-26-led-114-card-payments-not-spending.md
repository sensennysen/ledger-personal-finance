# LED-114 — Card payments are not spending — retro (2026-09-26)

- OD-2 (b), and the premise was stale. Since LED-146 a card payment is saved as a transfer into the card, and every spending calculation counts only `type = 'expense'` (`buildCategoryBreakdown`, `summarizeRange`, `entryBudgetImpact`, the `.eq('type', 'expense')` reads in `useBudgets` and `useOverspending`, `groupExpensesByCategory`). Nothing needed excluding. The ticket became a regression test, one predicate and a form change; 8 points became 2, and the CSV row says so.
- `isCardPaymentTransaction` in `src/lib/cardPayment.ts` names the rule; `tests/cardPaymentSpending.test.mjs` runs one fixture through the pure calculations (a transfer into a card adds 0, a loan repayment still counts) and checks the database filters in source, because `utils.ts` and the hooks import `@/`.
- The card form shows 12a's "💳 Card payments · Excluded from spending reports" as fixed text where the Category control was. Checked live at 1280: no category combobox, the line is there, and a 100 payment saved as a transfer with no category, the card balance went from -2,400 to -2,300 and the paying account from 5,000 to 4,900.
- `knowledge/rules/card-payment-is-a-transfer.md` step 3 now says LED-114 kept the model.

## Backlog
- The card dialog's subtitle still reads "Posts as an expense against the card", which has been false since LED-146.
- Category filter counts and the Categories page usage were not re-read for card payments (they use the same expense filter).
- Checked at 1280 only; not on a phone.
