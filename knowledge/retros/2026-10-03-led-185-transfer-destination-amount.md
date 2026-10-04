# LED-185 · Cross-currency transfers store a destination amount; Overspending prints one total — retro (2026-10-03)

Branch `epics-15-19` at `4ab1d00`. Decision OD-10 (a): store the destination amount on the transfer (migration).

## What was built
- **Migration** `supabase/migrations/20261003120000_transfer_destination_amount.sql`:
  - **The column.** `transactions.destination_amount numeric(18,2)`, null or > 0 (`transactions_destination_amount_check`).
  - **The balance trigger.** `update_account_balance()` credits a transfer's destination with `coalesce(destination_amount, amount * exchange_rate)` and reverses it the same way. `trg_update_balance_update` now also fires on `destination_amount`.
  - **The card sync.** `sync_card_payment_on_transfer_update()` credits the card by the same coalesce on both of its paths, and `trg_sync_card_payment_update` fires on `destination_amount`.
  - **Recurring posts.** `post_recurring_transaction()` copies `destination_amount`.
  - **Old rows.** Null keeps the old arithmetic, so there is no backfill and no existing balance moves.
- **`src/lib/transferCredit.ts`.** One client mirror of the credit: `transferCredit`, `isCrossCurrencyTransfer`, `destinationAmountFor`. It replaces the hand-written `amount * exchange_rate` in:
  - the local balance mirror (`useTransactions.helpers.ts`)
  - `runningBalance.ts`
  - `transactionWindow.signedAmount` (the transfer branch)
  - `AccountTransactionsPage` (transfers received)
  - `importDuplicates.ts`
  - the import dialog's match label
  - `cardPayment.creditedAmount`
- **Form.** A transfer into an account in another currency shows **Amount received (EUR)**.
  - **Prefill.** `amountInCurrency` fills it from the rate feed, with the import dialog's "Filled in from the exchange-rate feed, as of …" hint. It follows the amount until the user types.
  - **No rate.** With no rate it stays empty: "No exchange rate for USD to EUR. Enter what the account received."
  - **Validation.** The schema requires it (`buildTransactionSchema({ accountCurrency })`), and the submit saves `destinationAmountFor(...)`, so a same-currency transfer saves null.
  - **Rate stays 1.** `exchange_rate` is still 1 (`rules/foreign-currency-rate-of-one-is-not-a-rate.md`).
  - **Kind change.** A change of kind clears the field with the destination.
- **Field lists and export.**
  - `destination_amount` is added to the type, to Undo restore, to the template copy and to both edit forms' defaults.
  - The full transaction CSV gains **Amount Received** after Exchange Rate: 13 columns, `transactionCsv.test.mjs` updated.
- **Net worth over time.** `convertedNetWorthEffect` counts a transfer between currencies as (what arrived − what left), each converted by the rate table, plus the fee as before. An unconvertible side makes the effect null (left out and named), never 1.
- **Overspending.**
  - `convertOverspendingTotals` (`src/lib/overspending.ts`, over `sumConverted`) turns the per-currency totals into one figure in the default currency.
  - `useOverspendingReport` returns it for the card and the "Over budget" stat card, so they cannot disagree.
  - Both show `UnratedCurrencyNotice` for a currency left out. The card's hand-written note and the stat's " · plus EUR" sub-label are gone.
  - Rows still show each budget in its own currency.

## Acceptance
- **(a) OD-10 answered: PASS.** (a) in the decision register (`4ab1d00`).
- **(b) A cross-currency transfer changes both balances by the amounts the user sees: PASS.**
  - **psql, as the demo user with RLS, rolled back:**
    - **Insert.** 100 USD with 91.50 EUR received and a 2 USD fee took Checking 7123.80 → 7021.80 and the EUR wallet 50.00 → 141.50.
    - **Edits.** Editing only the destination to 92.00 moved only the wallet (→ 142.00). Editing the amount sent to 120 moved only Checking (→ 7001.80).
    - **Recurring.** The posted copy kept 91.50 and credited it.
    - **Delete.** Deleting both rows returned 7123.80 / 50.00.
    - **Same currency.** A same-currency transfer still credits its amount (Savings +25).
    - **Check constraint.** 0 is rejected.
    - **Card path.** An expense edited into a transfer to the card with 48.25 received recorded a 48.25 payment. Editing to 49.00 moved the payment row to 49.00, and the card went −1288.69 → −1239.69.
  - **Browser at 1280, Playwright:**
    - **Save.** The form saved `100.00 USD, destination_amount 91.50, exchange_rate 1`, and the balances moved −100.00 and +91.50.
    - **Account page.** The EUR account page shows "+€91.50 received".
    - **Empty field.** Saving empty is blocked with "Enter the amount EUR the account received".
  - **Browser at 390 and 1280, with a stored rate:**
    - **Prefill.** 100 → 91.50 and 250 → 228.75. A typed 228 is kept when the amount changes.
    - **Layout.** No horizontal overflow (field 334px at 390).
- **(c) Migration applies to an empty database and passes the CI `db` job: PASS.**
  - `supabase db reset --local` is clean.
  - `supabase db lint --local --level warning --fail-on error` reports "No schema errors found".
  - The seeded balances are identical with and without the migration (7 accounts, 93 rows, 13 transfers; diff empty).
- **(d) Overspending shows no "A + B" total: PASS.**
  - **Two currencies.** Entertainment $155.44 over and a EUR budget €45.75 over (at 1 USD = 0.915 EUR) show "Total over $205.44" and "Over budget $205.44 · 2 categories". Before, the card printed "$155.44 + €45.75".
  - **No rate.** With the EUR rate removed, both show $155.44 and "Excludes EUR overspending — no exchange rate set."
- **(e) Tests: PASS.**
  - `transferCredit.test.mjs` (4).
  - `transferDestinationSql.test.mjs` (4): reads the latest migration for the column, both coalesces, both trigger column lists, the card credits and the recurring copy.
  - Added cases in `runningBalance`, `overspending` (3), `periodCompare` and `transactionCsv`.
  - `pnpm lint`, `tsc -b`, `pnpm build` and `pnpm test` (848 passing, plus `tests/redesign.mjs`) are green.

## Deviations from the plan
- **`supabase/schema.sql` is not changed.** The plan said to mirror the column and trigger there. The rule (`rules/schema-changes-via-migrations.md`) says to update it only when the base needs to change, and the recent migrations (LED-190, 191, 230, 232) left it alone. Every database is built from the migrations (CI `db` job, `db reset`).
- **No form-schema unit test.** `transactionFormSchema.ts` imports through `@/`, which `node --test` cannot load. The rule it applies is `isCrossCurrencyTransfer` / `destinationAmountFor`, which are tested; the schema wiring was checked in the browser (the error message above).

## Backlog
- **Cross-currency transfers from a CSV import** are still refused: `importTransfer.ts` offers same-currency targets only, and a statement row carries one amount. Not in OD-10's scope.
- **Card and loan payments stay same-currency.** `cardPaymentTransfer` forces rate 1 with no destination amount. A card in another currency than its paying account is not offered.
- **Saved transfers between currencies from before LED-185** credited the destination one to one. Opening one in Edit now asks for the amount received, prefilled from the feed. Saving it corrects the balance, but nothing finds or flags these rows. A one-off check (`transfers where currency <> to-account currency and destination_amount is null`) would list them.
- **Net worth chart's excluded list** names the source currency when a cross-currency transfer cannot be converted, even when the unrated one is the destination's.
- **Local data.** The sweep added a EUR wallet, a "Travel EUR" category and budget, three LED-185 rows and a demo exchange-rate row with refresh set to manual, on the local database only. `pnpm db:reset` clears them.
