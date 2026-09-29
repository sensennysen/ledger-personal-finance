# LED-111 · New-transaction dialog states its kind, with Change kind — retro (2026-09-25)

## What shipped
- `TransactionEntryHeader`: a tinted icon tile, `TRANSACTION_KIND_DIALOG_TITLES[kind]` as the title ("New expense", "New income", "New transfer"), the kind menu's own description as the subtitle, and a **Change kind** link that opens `TransactionKindMenu` with the current kind marked (check mark and a background; `aria-current`).
- Choosing another kind swaps the form in place. `TransactionForm` watches `entryKind` and calls `form.reset(applyKindChange(values, next))`; the step state (loan chosen, picker return, auto category) resets during render.
- `applyKindChange` (`src/lib/transactionKindChange.ts`) keeps the fields every kind shares and clears what no longer applies. It was written for every kind pair here, so LED-112 only wires it.
- The menu's list now comes from one hook, `useKindMenuItems`, that the menu and the header both call. Icons and tints moved to `kindVisuals.ts`.
- The three create dialogs (AppLayout's sheet, Activity, an account page) render the same header. The form has no type control; it never did.

## Decisions
- **The header is rendered by the dialog owners, not inside the form.** The plan put it in `TransactionForm`, but the owners' `FormError` sits between the title and the form, and the header needs only the kind, which the owners already hold. Edit mode (LED-112) is the case that needed form state, and it uses the form's own selector.
- **Change kind is offered from expense, income and transfer only** (`canChangeKind`). A loan or card payment carries a locked account, a picker step, presets and generated descriptions, so it gets a title and a caption and no link. Choosing Loan or Card from a plain dialog is safe: `applyKindChange` empties `to_account_id` and the form's own auto-pick effects run.
- **Payment dialogs use the design captions, not the menu line.** The menu says "2 cards · $1,540.00 due", which is wrong once a card is chosen. 5b and 12a draw "Posts as an expense against the loan/card · type locked", so `kindDialogSubtitle` returns that.
- A loan's own page keeps its title "Pay Car loan" (states the action and names the loan); its kind is still Loan repayment, so no Change kind.
- `applyKindChange` drops the category on any type change (categories are typed) and on transfer, clears goal and fee where they do not apply, and never carries `to_account_id`.

## Acceptance criteria
- (a) Expense opens "New expense" with the tile, the menu subtitle and no type selector: PASS (browser at 1280, opened with the `E` key).
- (b) Change kind returns to the menu with the current kind marked; choosing another kind keeps amount, date and description: PASS (browser: expense to transfer with `T` kept 86.40, "Grocery run" and the date and dropped the category; phone sheet expense to income; expense to Card payment kept amount and description). Initial keyboard focus is not moved onto the marked item: the base-ui menu opens on its first item.
- (c) Loan repayment and card payment state their kind and show no Change kind: PASS (browser: "Record card payment", and "Pay Car loan" on the loan page).
- (d) Same header in the mobile add sheet at 390: PASS (browser, FAB sheet from Home).
- (e) Lint, build and test: PASS (495 tests at this commit).

## Backlog
- The Change kind menu opens as a bottom sheet from inside a dialog below 768px. It worked at 390 in the browser (sheet over dialog, choosing a row swaps the form and closes the sheet); not tried on a real iOS device.
- The dialog header wraps "Change kind" onto its own line at 390. Left as is.
- Not checked in the light theme (header only; the tokens are shared with the menu).
- The FAB still opens an expense directly (LED-109 retro); Change kind is the way back.
- Templates: Change kind on a template-opened dialog keeps the template's amount and description like any other shared field. Not exercised.
