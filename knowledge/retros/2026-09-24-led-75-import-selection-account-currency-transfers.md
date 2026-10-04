# LED-75 · Selectable rows, real preview, right account, right currency — retro (2026-09-24)

Epic 6 phase 3, first ticket (commit f44ba69).

## What shipped
- **Selection.** `csvImport.ts` replaces `includedDuplicates` with `toggled`, the rows flipped from their default.
  - Defaults: clean and warning rows start ticked, duplicates start unticked, and error rows can't be ticked.
  - Skipping a cause still overrides every row under it.
  - New: `isSelectable`, `isSelected`, `selectAll`, and `deselected` and `excludedDuplicates` in the summary.
  - The dialog has a checkbox on every selectable row, a select-all, and a footer reading "N of M selected · K duplicates skipped".
- **Preview.** It was already full and windowed (LED-65), so the "8 of 142" part of the ticket was done.
- **Account.** No `accounts[0]` auto-pick. The account is only preselected when it's the only one. Until one is chosen, the button reads "Choose an account" and stays disabled.
- **Currency** (`importCurrency.ts`, pure).
  - A statement currency select defaults to the account's currency.
  - When the two differ, a warning appears with a "1 PHP = [rate] USD" input, and the import is blocked until the rate is above 0.
  - Amounts are converted to the account's currency before both the duplicate match and the write. The preview shows the statement amount with the converted amount under it.
  - The user types the rate because nothing in `src/` reads the `exchange_rates` table, and the balance trigger adds income and expense amounts unconverted.
- **Transfers** (`importTransfer.ts`, pure).
  - A row can be made a transfer to or from another account in the same currency. Loans are excluded, because a repayment is an expense with a destination.
  - `transferLegs`: money out is written from the imported account to the other one; money in is written from the other account to the imported one. Either way it's one row of type `transfer`.
  - "Make a transfer?" is suggested for bank transfer wording, or when a rule has `type_hint: 'transfer'` (wired in LED-74).
  - **No migration was needed**: the type, `to_account_id` and the balance trigger already existed.
- **Duplicates across statements.**
  - `useImportDuplicates` now reads `account_id = X or to_account_id = X`, through `readAllPages`.
  - `matchDuplicates(rows, existing, importAccountId)` matches existing transfers on date + amount + direction, ignoring the description. A transfer into the account matches at `amount × exchange_rate`.
  - So after one statement's side is imported as a transfer, the other statement's side shows as "already in Ledger".

## Acceptance criteria
- Full, selectable preview: **PASS**. Unit-tested: selection defaults, unticking, select-all, and error rows having no checkbox.
- Explicit account selection, with no silent first-account default: **PASS**, checked by reading the code.
- Currency shown, and converted or warned about correctly: **PASS**. Conversion and the rate gate are unit-tested; the UI was checked by reading the code.
- A transfer kind, so a transfer doesn't import twice: **PASS**.
  - Legs and direction matching are unit-tested.
  - On the local database, as the test user under RLS and rolled back, two import-shaped transfers were inserted. Checking went 9,901.20 → 9,601.20 and savings 1,000 → 1,300, and the duplicate read returned both.

## Issues found in validate
- None blocking. Apply-time fix: three manual `useMemo`s tripped the React Compiler lint. Recorded as the rule `knowledge/rules/no-manual-memo-on-derived-values.md`.

## Backlog
- **Not verified in a browser** (signing in needs a password). Unconfirmed:
  - The account and currency row at 375, 768 and 1280.
  - The per-row Select inside the scrolling table.
  - Select-all with a few thousand rows.
- **No automatic rate.** `exchange_rates` exists in the schema but nothing fills it or reads it on the client. Pre-filling the rate input from it would be a follow-up.
- **A converted import loses the original amount.** Re-importing the same foreign statement at a different rate won't be flagged as a duplicate.
- **Transfers are same-currency only.** A cross-currency transfer would need a second rate.
- **Card payments and loan repayments can still import twice.** They are expenses with a `to_account_id`. The card or loan statement's credit isn't matched against them, so importing that statement can add them again. This predates this ticket.
- **Mockup items not built:** the "Net effect" stat and the step wizard. The tablet layout's "no Type column" item doesn't apply, because there is no Type column.
- Ticket CSV statuses are not updated.
