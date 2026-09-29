# LED-147 · Import leftovers — retro (2026-09-26)

## What shipped
- **Ambiguous date order** (`ambiguous-date`, a warning). `dateOrderIsAmbiguous` is true when at least one slash date reads either way and none has a part over 12. `processFile` returns `dateOrderAmbiguous`; the dialog flags each such row until the user picks an order, either one. The panel has the D/M/Y toggle (now one `DateOrderToggle` shared with the `bad-date` panel) and no skip button. A file that contradicts itself is not ambiguous; its bad dates stay `bad-date`.
- **Apply to N similar rows.** `similarRows` (same payee key and type) after a category pick; the dialog offers Apply / Not now, then Undo. Rows with their own pick, a transfer, an error, or left out as a duplicate are never touched.
- **Loan repayment duplicates.** `matchDuplicates` treats an expense with a target account like a transfer: date, amount and direction, on both the loan's side (credit) and the payer's side (debit). The dialog words the match as "payment from/to".
- "No category match" already shipped with LED-74; checked, no change.

## Correction to the ticket
Card payments are transfers (`rules/card-payment-is-a-transfer.md`), and LED-75 already matches transfers, so only loan repayments were still missing. The ticket's "expenses with a to_account_id" for cards was never true in the database.

## Acceptance
- (a) An all-ambiguous file shows the warning and D/M/Y clears it: PASS live (4 rows flagged; after D/M/Y the dates read 2026-04-03 etc.).
- (b) "No category match" is a cause with its rows: PASS live (3 rows).
- (c) One pick offers same-payee rows and can be undone: PASS live (2 rows applied, Undo returned them to "Choose…").
- (d) A statement credit matching a loan repayment is a probable duplicate, skipped by default: PASS by unit tests (credit side, payer side, one credit per repayment, amount and direction); not run through the dialog.
- (e) Matching logic unit-tested in `src/lib`: PASS.
- (f) Lint, build, test: PASS (617).

## Backlog
- Run a real loan statement CSV through the dialog to see the "Matches payment ..." line.
- The offer disappears on the next pick or file change; it is not kept per row.
- Not built (Parked in the ticket): subcategory suggestions, saving a pick as a rule, duplicates within one CSV.
