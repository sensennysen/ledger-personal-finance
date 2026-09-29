# LED-145 · Home: Pay now, phone fold, queued marker — retro (2026-09-26)

## What shipped
- `UpcomingBill.payment` (`accountId`, `amount`, `date`) on loan bills, both the loan-account deadline and the per-purchase installment. **Pay now** opens the loan repayment form through `openAddTransactionModal('loan-repayment', { targetAccountId, prefill })`; `AppLayout` passes `prefill` as `defaultValues`.
- Recurring bills get no button: the database only allows a destination on a loan, and loan destinations are already excluded from that list. Card dues are not in the strip.
- `DashboardRecentTransactionsCard` shows "Not synced yet" for a queued row.
- The phone stats card is 184px (was 208): `p-4`, tighter gaps, `py-2` In/Out tiles.
- Budget Progress already used `budgetTone` (LED-117); no change.

## Found on the way
- The locked-target Pay from bug (see LED-146) meant Pay now opened with the wrong account. Fixed in `TransactionForm` for loans and cards.
- **The queued marker did not show on Home.** Each `useTransactions` instance has its own list, so an entry queued from the layout's form reached the cache but not Home. Fixed with `registerTransactionsListener` / `notifyTransactionsRefresh` (`patterns/hook-instances-do-not-share-state.md`).

## Acceptance
- (a) Pay now opens the right form prefilled for that account: PASS live (Phone Loan, 1,000, 2026-09-29, Pay from Main Bank, description filled).
- (b) The first four widgets fully above the fold at 390x844: **FAIL, measured.** With the database's default order the first four are stats (184px), credit cards (179), cash flow (387) and category pie (331), starting at y=176; the bottom nav begins at y=756. Stats and cards now end at 554, and cash flow shows 186px of its 387px. Four widgets cannot fit whatever the stats card does; the order default is LED-134 (OD-1).
- (c) Queued rows show the marker on Home: PASS live after the fix ("Offline coffee ... Not synced yet").
- (d) Budget Progress uses the shared tone helper: PASS (already).
- (e) Lint, build, test: PASS (617).

## Backlog
- Decide what "first four widgets above the fold" means (LED-134 / OD-1): a shorter cash flow chart on phones, or fewer widgets above it.
- Offline, the add form opens with "Select account" and USD until the cached accounts arrive; the user must pick an account. Not caused by this ticket.
- Pay now for a loan bill in the past dates the payment on the old due date.
- The Recent Transactions marker has no test beyond the live check.
