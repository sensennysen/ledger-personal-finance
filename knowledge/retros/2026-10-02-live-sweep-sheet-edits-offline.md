# Live sweep · phone sheet fields, loan and card edits, offline saves per kind (LED-208) — retro (2026-10-02)

Tree tested: branch `epics-15-19` at `4fdcdc6` (no source changed). Covers what the transaction-kinds sweep (`2026-09-26-live-sweep-transaction-kinds.md`) left open:
- the "More details" fields saved from the phone sheet;
- editing a saved loan repayment or card payment;
- a payment that reaches an interest-bearing purchase;
- an offline save of each kind (LED-124 did expenses only).

## Method
`knowledge/patterns/live-sweep-method.md`. All checks ran at 390×844 with touch emulation, using Playwright Chromium on the Vite dev server against a local Supabase, as the seeded demo user. No live account was touched.
- Every save was checked in psql: the row, the account balances, `loan_payment_allocations`, `credit_card_payments` and the card's last-payment columns.
- Offline used a real network cut (`context.setOffline(true)`), with no reload while offline. The add sheet was opened from the FAB, and the kind was changed with "Change kind".
- The demo card has no locked statement (`statement_balance` is null), so the statement's paid amount stays 0.00 throughout. The card checks rest on the payment row and the last payment. LED-193 already measured a statement moving on drain.

## Results
**10 PASS · 1 FAIL · 0 not checkable** (2 notes)

### FAIL (each has a new ticket in `epic-20-phase-4-sweep-findings-tasks.csv`)

| Ticket | Item | Evidence |
|---|---|---|
| LED-230 | An Expense edited into a transfer to a card records no card payment | The same row edited back, Kind Expense → Transfer, To account Visa Platinum, 700.00: balances return to Everyday Checking=7051.35, Visa Platinum=-1528.74 (correct), but no credit_card_payments row is created (0 rows for the transaction) and the card's last payment stays 650.00\|2026-08-10. A transfer into a card created any other way (the Card payment kind, a plain Transfer to the card, a recurring transfer, a queued one draining) gets its payment row and statement step; an edit never does. Expected: the same statement steps as a create when an edit makes the row a transfer into a card (and when it moves an existing transfer onto a card). useCardPayment runs only on the create paths; the LED-191 trigger updates or deletes a linked row but never inserts one. |

### PASS

| Item | Evidence |
|---|---|
| Phone sheet (390): tags, goal, receipt, recurring settings and notes under "More details" are saved | New expense from the add FAB, Everyday Checking, Groceries, 23.45, "SWEEP-208 phone details"; under More details: notes, tags sweep208 and phone (Enter), goal Japan Trip, Recurring on, Interval Monthly, End Date 2027-03-01, a 40x60 PNG receipt. Saved row: notes "Paid at the farmers market", tags {sweep208,phone}, goal Japan Trip, is_recurring t, interval monthly, end 2027-03-01, receipt_url 11111111-1111-4111-8111-111111111111/25b5ec49-fb24-40d6-980f-f952c89c1d6a.png, category Groceries, date 2026-10-02; storage.objects: receipts\|11111111-1111-4111-8111-111111111111/25b5ec49-fb24-40d6-980f-f952c89c1d6a.png\|111\|image/png (bucket, path, bytes, type). Checking 7168.80 → 7145.35 (−23.45). |
| Editing a saved loan repayment row (390) | Activity, Sep cycle, "Car loan installment" 456.00 → entry sheet → Edit entry opens "Edit loan repayment · Posts as an expense against the loan · type locked" (no Kind selector, so the type cannot change). Amount 456 → 500: Car Loan=-15048.00, Everyday Checking=7145.35, Visa Platinum=-1578.74 → Car Loan=-15004.00, Everyday Checking=7101.35, Visa Platinum=-1578.74 (loan +44.00, checking −44.00); allocation for the row 456.00\|1 → 500.00\|1 (sum, rows). |
| Editing a saved card payment row (390) | "Visa payment" 650.00 → Edit entry opens "Edit transaction" with Kind = Transfer (options Expense, Income, Transfer), From Everyday Checking, To Visa Platinum. Amount 650 → 700: Car Loan=-15004.00, Everyday Checking=7101.35, Visa Platinum=-1578.74 → Car Loan=-15004.00, Everyday Checking=7051.35, Visa Platinum=-1528.74 (card +50.00, checking −50.00); its credit_card_payments row 650.00\|2026-09-10 → 700.00\|2026-09-10; card last payment null paid 0.00 last 650.00 on 2026-09-10 → null paid 0.00 last 700.00 on 2026-09-10 (no statement is locked on the demo card, so the paid amount stays 0.00). |
| A card payment edited to an Expense with the Kind selector leaves the card and its payment log in step | Kind Transfer → Expense (category Shopping): Everyday Checking=7051.35, Visa Platinum=-1528.74 → Everyday Checking=7051.35, Visa Platinum=-2228.74 (the 700.00 goes back on the card, checking unchanged); payment rows for the transaction 1 → 0; card last payment 700.00\|2026-09-10 → 650.00\|2026-08-10 (the previous payment). LED-191's trigger at work. |
| A payment that reaches an interest-bearing purchase (390) | Car Loan, purchase "2022 Honda Civic" at 0.4500% a month (installment 456.00). Loan repayment from the phone sheet, 456.00 from Everyday Checking, Transportation. Preview: "How this payment is applied, as paid on Oct 2, 2026 \| 2022 Honda Civic \| Installment 16 of 48 \| $456.00 \| $14,548.00 left", "15 of 48 → 16 of 48 paid". Saved: allocation 2022 Honda Civic 456.00 (matches the preview); Car Loan=-15004.00, Everyday Checking=7051.35 → Car Loan=-14548.00, Everyday Checking=6595.35 (loan +456.00, checking −456.00); loan page "Outstanding $14,548.00", "16 of 48 installments". |
| Offline save from the phone sheet: Expense | Network cut (context.setOffline), no reload. Saved 11.11: the sheet closed and the banner read "Offline — 1 entry will sync when you reconnect"; queued as {"op": "insert", "type": "expense", "amount": 11.11, "to": null, "status": "pending"}. 0 of the five rows in the database before reconnect; after reconnect the queue drained (0 left) and the row reads "expense\|11.11\|Everyday Checking\|\|Groceries"; checking −11.11. |
| Offline save from the phone sheet: Income | Network cut (context.setOffline), no reload. Saved 22.22: the sheet closed and the banner read "Offline — 2 entries will sync when you reconnect"; queued as {"op": "insert", "type": "income", "amount": 22.22, "to": null, "status": "pending"}. 0 of the five rows in the database before reconnect; after reconnect the queue drained (0 left) and the row reads "income\|22.22\|Everyday Checking\|\|Salary"; checking +22.22. |
| Offline save from the phone sheet: Transfer | Network cut (context.setOffline), no reload. Saved 33.33: the sheet closed and the banner read "Offline — 3 entries will sync when you reconnect"; queued as {"op": "insert", "type": "transfer", "amount": 33.33, "to": "003", "status": "pending"}. 0 of the five rows in the database before reconnect; after reconnect the queue drained (0 left) and the row reads "transfer\|33.33\|Everyday Checking\|High-Yield Savings\|"; checking −33.33, High-Yield Savings +33.33. |
| Offline save from the phone sheet: Card payment | Network cut (context.setOffline), no reload. Saved 44.44: the sheet closed and the banner read "Offline — 4 entries will sync when you reconnect"; queued as {"op": "insert", "type": "transfer", "amount": 44.44, "to": "005", "status": "pending"}. 0 of the five rows in the database before reconnect; after reconnect the queue drained (0 left) and the row reads "transfer\|44.44\|Everyday Checking\|Visa Platinum\|"; checking −44.44, Visa +44.44; on drain the payment row was created (Visa payment rows 2 → 3, amount 44.44) and the card's last payment became 44.44\|2026-10-02\|0.00; while queued the app said "Payment saved offline. The payment for Visa Platinum syncs when you are back online, and its statement updates then.". |
| Offline save from the phone sheet: Loan repayment | Network cut (context.setOffline), no reload. Saved 55.55: the sheet closed and the banner read "Offline — 5 entries will sync when you reconnect"; queued as {"op": "insert", "type": "expense", "amount": 55.55, "to": "007", "status": "pending"}. 0 of the five rows in the database before reconnect; after reconnect the queue drained (0 left) and the row reads "expense\|55.55\|Everyday Checking\|Car Loan\|Transportation"; checking −55.55, Car Loan +55.55; allocation after drain 55.55. |

### Notes

| Item | Evidence |
|---|---|
| Balances across the five offline saves | Before {'chk': 6595.35, 'sav': 10150, 'visa': -1528.74, 'loan': -14548}, after {'chk': 6473.14, 'sav': 10183.33, 'visa': -1484.3, 'loan': -14492.45}: checking -122.21 (= −11.11 + 22.22 − 33.33 − 44.44 − 55.55), savings +33.33, Visa +44.44, Car Loan +55.55. |
| A card payment edits as a plain transfer | A saved card payment opens as "Edit transaction" with a Kind selector (Expense / Income / Transfer), while a loan repayment opens as "Edit loan repayment · type locked". Both save correctly; the difference is wording and whether the kind can change. Recorded, not ticketed; LED-230 may settle it. |

## Notes
- Every item has a result, balances agree after each save, and the one FAIL has a ticket (LED-230 in `epic-20-phase-4-sweep-findings-tasks.csv`). LED-208 is Done.
- The edit that removed the card payment (Transfer → Expense) works because of LED-191's trigger. LED-230 is the reverse direction, which no path covers.
- The loan's "Next payment" moved to $412.00 on Feb 15, 2027 after the Sep repayment was edited from 456 to 500. The extra 44.00 counts toward the next installment, consistent with the tracker. The far-off date comes from the seed (see the LED-205 retro note).

## Backlog
- The sweep changed demo rows: two Sep payments edited, test rows added. The local database is reset at the end of the phase.
