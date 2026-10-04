# LED-76 · Accounts comparison layout and per-row context — retro (2026-09-24)

## What shipped
- `src/lib/accountsOverview.ts` (tested): asset share %, liabilities, totals, `comingUp`, `loanProgress`, `cardAmountDue`. `creditCards.ts` now imports `./loans.ts` so `node --test` can load it.
- `AccountsPage`: a four-cell band (Assets, Liabilities, Net Worth, Coming up). Assets and Liabilities sit side by side at lg.
  - Asset rows carry a share bar.
  - Liability cards carry a utilisation bar (cards) or a repayment meter ("34 of 48 paid") for loans, plus Pay card / Repay loan / View.
  - Grouped/flat view and rearrange are kept. The arrow buttons swap within the column.
- `openAddTransactionModal(kind, { targetAccountId })` locks the card or loan. `QuickEntry` passes it through; its `defaultValues` would otherwise reset `to_account_id` to null.

## Decisions
- No exchange-rate table exists, so totals count only the default currency. Other-currency rows say "No EUR rate — not in totals", and the footnote names the currencies. Before this, EUR balances were added to USD as if they were the same currency.
- The per-card `Due: Nd` badges are gone. Dates live in Coming up only, as the acceptance criteria ask.

## Acceptance
- Share bar per asset row: PASS (browser, 390/1280/1920).
- Excluded-currency warning on the row: PASS (browser).
- Due dates in one Coming up cell: PASS (browser).
- Pay card / Repay loan: PASS (browser; the sheet opens with the card or loan locked, at 1280 and 390).
- Loan progress meter: PASS (browser).

## Issues found in validate (`e15df59`)
- On phones Coming up was half width and truncated to "Car l…". It now spans the band below lg.
- At 1280 the Type column squeezed names to "Emergenc…". It now shows from 2xl; below that the type sits under the name. Liability cards pair up only at 2xl.

## Backlog
- **Home net worth still mixes currencies** (`getBalanceSummary` in `useDashboardData`). Accounts and Home disagree when a non-default-currency account exists. Needs either the same exclusion or an exchange-rate table.
- The 6a filter tabs (All / Assets / Liabilities / Archived) aren't in the acceptance criteria and aren't built.
- Grouped view still has no per-account rearrange (unchanged).
- A card balance can't be entered as a credit (overpayment): the form stores both 500 and −500 as owed (unchanged, now explained in the form).
