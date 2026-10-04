# LED-113 · Card payment 12a layout at three sizes — retro (2026-09-25)

## What shipped
- **720px modal.** `entryDialogWidthClass(kind)` gives the card payment dialog `sm:max-w-[min(720px,calc(100vw-3rem))]` and every other kind `max-w-md`. AppLayout, Activity and the account page all use it. Below 640 it is the existing phone sheet.
- **Layout.** For a card payment the amount and presets follow the band, as 12a draws; every other kind keeps them below account and category (`amountFields`, rendered in one place or the other).
- **Band.** Three cells from `sm` up: "Current balance", "Available credit" with "of $4,000.00 limit", "After this payment" with "paid in full" or "statement credit". Below `lg` the labels shorten to "Available" and "After payment" and the limit note drops, and the preset reads "Full" (tablet only; the phone keeps "Full balance"). Below `sm` a two-cell band: "Owed now" and "Due Oct 1 / in 21d".
- **Dates.** The statement and due line names real dates, "Statement closes Oct 16 · payment due Oct 1", from `nextDayOfMonthDate` / `getCardDateInfo`. `daysUntilDayOfMonth` now delegates to `nextDayOfMonthDate`, with the same result. Utilisation reads 31.0% at sm and up, 31% on the phone.
- **No silent card pick.** `resolveInitialCardId`: a locked card, or the one card that owes, is picked; with two or more owing the "Card to pay" field starts empty ("Choose a card") and the band stays hidden until one is chosen.

## Decisions
- **(d) Prefilled amount.** The band is hidden when editing a saved payment, because the stored balance already includes it, and shown otherwise, including when a template or a caller prefills the amount, because the balance does not include it yet. The LED-24 retro said "edit or template"; the code only ever hid it for edit.
- **(e) Multi-card pick.** No preselected card with two or more owing, the rule from LED-104. Where 12a draws a card chosen (BPI Rewards Visa) it has one card in play. The form's own combobox is the picker; no separate picker step was built, since a single required field does the job.
- "Minimum" is still not offered: Ledger has no minimum-payment data (LED-24). The 12a footnote is unchanged.
- The edit dialogs stay `max-w-md`; the wide layout is for creating a payment.
- The category line stays Uncategorized (LED-114, blocked on OD-2).

## Acceptance criteria
- (a) Desktop renders the 720px modal and layout: PASS (browser at 1920x1080, measured 720px, dark).
- (b) Tablet renders the three-cell band: PASS (768x1024: dialog 720px at left 24px, labels "Current balance / Available / After payment", preset "Full", dark).
- (c) Mobile uses the drawn wording and real dates: PASS (390x844, dark and light, both from the account page and from the Accounts page sheet: "Owed now $1,240.00", "Due Oct 1 / in 6d", and "Statement closes Oct 16 · payment due Oct 1").
- (d) Stats band behaviour for prefilled amounts decided and documented: PASS (above).
- (e) Multi-card auto-pick decided and recorded: PASS (above; verified live: two owing cards leave "Choose a card" empty, and choosing BPI shows the band).
- (f) 1920x1080, 768x1024 and 390x844 in light and dark: PARTIAL. Dark at all three sizes, light at 390 and a light 1920 view of the two-card flow (not measured); light at 768 not checked.
- (g) Lint, build and test: PASS (508 tests).

## Found and not fixed (out of scope): a card payment cannot be saved
Trying to save from the Accounts page sheet failed twice over, before any request:
1. **Schema.** `transactionFormSchema` requires a category for any expense with a destination ("Choose an expense category for this loan repayment"). It fires for card payments, which have no category by design, so Uncategorized cannot submit.
2. **Database.** `enforce_loan_repayment_destination` raises "Expense destination must be a loan account" for an expense whose destination is a credit card (reproduced with psql on the local database; the same function is in `prod_dump_schema.sql`). Even with a category chosen the insert is rejected.
The LED-24 retro recorded "not verified in a browser"; this is what that hid. A background task was raised for it. LED-114's fallback sentence ("card payments remain Uncategorized expenses") is not true today.

## Backlog
- **Pay from** is empty on the account page and Accounts page paths ("Account is required" on submit) but preselected from Activity. LED-146 owns one card-payment path.
- 12a draws "Repeat monthly on the 1st" as a visible toggle; here recurring is still under More details.
- "After payment" shows the current balance while the amount is 0; the design's example has the amount filled.
- "Statement closes" is the next occurrence of the statement day, so it reads Oct 16 on Sep 25; 12a's example date (Sep 16) is earlier in the month.
- Checked in a browser pane, not on a real iOS device.
