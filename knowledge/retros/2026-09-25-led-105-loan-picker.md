# LED-105 · Loan picker step — retro (2026-09-25)

## What shipped
- `LoanPicker` (`src/components/transactions/LoanPicker.tsx`): with two or more loans the repayment dialog opens on a list. Each row shows the name, `formatLoanSchedule`, outstanding, and the next deadline (amount and date) when one is due by the end of the current cycle, else "Nothing due this cycle".
- Rows sort by `sortLoanChoices` (nearest due date, then largest outstanding, loans with nothing due last). `hasLoanPickerStep` decides show or skip: a locked loan, editing, or fewer than two loans skip it. `nextDeadlineInCycle` is the "current cycle" rule: the nearest unpaid deadline due on or before the end of the user's current budget cycle, overdue included.
- `TransactionForm` swaps the picker in while `loanChosen` is false. Choosing a row runs `handleLoanChange`. A "Back" button on the form returns to the picker; react-hook-form state persists, so the row stays marked (`aria-current`).
- The picker reads with `useLoanPurchases()` (no account id, so one read for all loans). That hook's allocations read is now paged with `readAllPages`, per `rules/page-reads-past-1000-rows.md`.
- A failed read shows an `InlineLoadError` with Retry. Rows stay selectable and read "Due date unavailable"; they never read as "nothing due".

## Acceptance criteria
- (a) 2+ loans open the picker first: PASS (browser, 1280 and 390).
- (b) Rows show name, schedule, outstanding, next deadline: PASS (browser).
- (c) Sort order unit-tested: PASS. Browser: the loan with a due date sorted first.
- (d) Choosing calls `handleLoanChange`; Back returns with the row still selected: PASS (browser, `aria-current` on Car loan, focus on the picker heading).
- (e) One loan and a locked loan skip the picker: PASS (browser: second loan set inactive, then the loan account page).
- (f) A failed read shows an error state with retry: PASS (browser: `loan_purchases` renamed on the local database; error and "Due date unavailable" appeared, Retry loaded the rows after the table came back).
- (g) Focus: PASS on open (the dialog title, which is the LED-91 target, holds focus) and on Back (the picker heading). Return-to-trigger on close was not re-checked.
- (h) Lint, build, test: PASS (465/465).

## Decisions
- Picker state lives in `TransactionForm`, not `AppLayout`, so the three call sites are unchanged.
- The read failure message is the hook's generic "Couldn't load that. Try again."

## Backlog
- On phones the Back button lands below Cancel (`flex-col-reverse`). Reads oddly; consider a header back control.
- Return-to-trigger focus after closing from the picker was not checked.
- Tested with Chrome's emulated 390 px, not a real phone.
