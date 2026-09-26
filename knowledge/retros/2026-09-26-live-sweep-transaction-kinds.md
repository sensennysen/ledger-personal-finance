# Live sweep · every transaction kind on the mobile sheet (LED-127) — retro (2026-09-26)

Tree tested: branch `epics-8-13-phase-12` at `9694f7f` (tip of phase 11 plus the three earlier sweep retros; no source changed). Lint, build and all 666 tests were green on `4ab1888` before the phase.

## Method
Same as LED-124 (`knowledge/patterns/browser-check-with-local-user.md`): local Supabase only, headless Chrome over CDP with touch emulation at **390x844**, throwaway user `sweep-d@example.test` seeded with a cash wallet, checking, savings, a credit card and **one loan account with three purchases** (two at 0%, one at 2%). A second loan account was added part-way to test the picker. Every save was checked in `psql` against the rows written and the account balances the triggers produced, and each loan repayment's `loan_payment_allocations` rows were compared with the preview shown before saving. Desktop (1920, 1280, 768) was used only for the kind menu key caps, the edit dialog and the card payment layout. Screenshots and scripts stay in the session scratchpad.

## Results
**15 PASS · 0 FAIL · 1 not checkable** (3 notes)

### FAIL (each has a new ticket in `epic-14-live-sweep-findings-tasks.csv`)

| Ticket | Item (from) | Evidence |
|---|---|---|

### PASS

| Item (from) | Evidence |
|---|---|
| Add sheet at 390x844: height, pinned Save, page not scrolling behind (LED-103) | FAB opens the New expense form as a bottom sheet at y=84, 760px high (scrollHeight 761 / clientHeight 760); 'Save Transaction' and 'Cancel' stay at y=724–764 after scrolling the sheet by 200px; body overflow is hidden and main's scrollTop stays 0. (Literal main.scrollHeight = clientHeight does not hold on Home, whose page is 1,798px tall behind the sheet; nothing behind can scroll.) |
| A save of each of the five kinds from the phone sheet, with the balance effect in the database (LED-103) | sweep-d: expense 12.50 Cash Wallet/Groceries (Cash 500 -> 487.50); income 100 BDO/Salary (4,200 -> 4,300); transfer 50 BDO -> Emergency Savings (4,300 -> 4,250, 8,000 -> 8,050, row type transfer); loan repayment 250 Cash Wallet -> Phone Loan (Cash -250, loan -3,144 -> -2,894, 2 allocation rows); card payment 300 Cash Wallet -> Visa Rewards (row type transfer, Cash -300, Visa -1,200 -> -900, 1 credit_card_payments row of 300) |
| One loan opens the repayment form directly with the loan chosen (LED-104) | One loan account: Change kind > Loan repayment opens 'Record loan repayment' with Phone Loan selected, no picker |
| Two loans open the picker; the form is unreachable until one is chosen (LED-105) | After adding Car Loan: 'Which loan are you repaying?' lists Car Loan (day 5, nothing due, $5,400.00 outstanding) and Phone Loan; the dialog has no Amount field until a loan is chosen; choosing Car Loan opens the form with a Back button |
| Repayment summary band and presets (LED-106) | Band: Outstanding $3,144.00 · Installment due $250.00 Aug 15 · 42 days overdue · After this payment $2,894.00 '0 of 15 → 0 of 15 paid'; presets Installment / Pay in full / Custom; Pay in full fills 2894 |
| The allocation preview equals loan_payment_allocations, purchase for purchase (LED-107) | Installment 250 preview: Phone $208.33, Earbuds $41.67, Laptop $0.00; saved rows: Earbuds 41.67, Phone 208.33 (no Laptop row). Pay in full 2,894 preview: Phone $1,291.67, Earbuds $258.33, Laptop $1,344.00; after saving every purchase has 0.00 left and allocations total 3,144.00 (the loan is at 0.00). |
| Pay in full saves without tripping the cap; After this payment is never negative (LED-106) | Pay in full saved with no alert; Custom 99999 shows 'After this payment —' with 'Payment cannot exceed the outstanding loan amount' (the amount is not silently clamped or shown negative) |
| Kind menu: Liabilities group, live descriptions, loan tile (LED-108) | Desktop menu and 390 sheet: Expense / Income / Transfer, then 'LIABILITIES' with 'Loan repayment · 2 loans · $5,400.00 owed' and 'Card payment · Visa Rewards · $900.00 due' (both update after data changes); the loan tile icon is gold-toned |
| Kind menu as a bottom sheet below md (LED-109) | 390: 'What would you like to record?' sheet at y=427, 417px high, not scrollable, over the New expense sheet; Expense shows a check as the current kind |
| E / I / T key caps on the desktop menu, none on the phone sheet (LED-110) | Desktop menu items read '… E', '… I', '… T'; pressing E in the open menu opens 'New expense'; the 390 sheet shows no key caps |
| New-transaction dialog states its kind, with Change kind (LED-111) | 390 and 1280: 'New expense · Money spent from an account · Change kind' (also New income / New transfer); Change kind opens the kind menu |
| Edit mode Kind selector clears fields that no longer apply (LED-112) | Activity > entry > Edit entry: Kind select offers Expense / Income / Transfer. Expense -> Transfer: category cleared, 'To account' appears, amount kept; Transfer -> Income: destination gone, category 'Uncategorized'; back to Expense; Cancel leaves the row as expense 12.50 with its category. |
| Card payment 12a layout at 1920, 768 and 390; overpayment notice and 'Pay $X instead' (LED-113) | 1920: 720x778 dialog with Current balance / Available credit / After this payment, Utilisation 18.0% → 18.0%; 768: 720x762 at x=24; 390: full-width sheet with 'Owed now $1,200.00 · Due Oct 10 in 14d', Full balance / Statement balance presets. Amount 5000: 'This is $3,800.00 more than the card owes. The extra becomes a statement credit…' with 'Pay $1,200.00 instead' which sets the amount to 1200. |
| Change kind keeps what was typed (LED-111) | 390: account 'Cash Wallet', amount 7 and description 'keep me' entered on New expense are still there after Change kind > Income; the category returns to 'Uncategorized' |
| Validation and dismissal on the phone sheet (LED-103) | Empty amount: 'Amount must be positive'; empty description: 'Description is required'; nothing saved (database count 0); Esc closes the sheet and focus returns to the FAB |

### Not checkable

| Item (from) | Reason |
|---|---|
| Decimal keypad (inputMode) on a real iOS device (LED-103) | no iPhone; inputMode='decimal' is set on the Amount input (code only) |

### Notes (no verdict)

- A fully repaid loan is still offered (LED-105) — After paying Phone Loan in full it stays in the picker ('$0.00 outstanding') and in the menu count ('2 loans')
- Utilisation precision differs by size (LED-113) — 390 shows '24% → 24%', 768 and 1920 '18.0% → 18.0%'
- The phone sheet requires a description for every kind (LED-153) — 'Description is required' on an income saved with only account, category and amount; the removed keypad sheet filled 'Expense' / 'Income' / 'Transfer' as a fallback (LED-103 retro, LED-153 / OD-6 is Blocked on this)

## Backlog (deferred or not verified)
- No real iPhone: the decimal keypad, safe-area insets on the pinned Save and the kind sheet, and the iOS keyboard pushing the sheet were not checked.
- Only the amount, description, category and account fields were exercised on the phone sheet. Tags, goal, receipt and recurring settings under "More details" were not saved from it.
- The edit dialog's Kind selector was checked on an expense; editing a saved loan repayment or card payment row was not tried.
- A payment on a loan with an interest-bearing purchase was compared for the 2% Laptop purchase only at zero allocation (its first installment was not yet due); the split of a payment that reaches an interest purchase is covered by the LED-107 unit tests.
- Card payments write a transfer and a `credit_card_payments` row (two records for one payment; LED-146 retro). Balances agreed in this run.
- Offline saves of each kind were checked in LED-124 for expenses only.
