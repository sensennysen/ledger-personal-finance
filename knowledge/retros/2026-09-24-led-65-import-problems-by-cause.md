# LED-65 · Import: group problems by cause — retro (2026-09-24)

## What shipped
- `src/lib/csvImport.ts` (pure):
  - Moved out of the dialog unchanged: `parseCSVText`, `findHeaderRowIndex`, `detectFormat`, and `processFile`'s structural errors.
  - `parseDate(value, order)` range-checks dates. It fixes a live bug: `17/09/2026` used to be written as `2026-17-09`.
  - `detectDateOrder` picks D/M/Y or M/D/Y from dates only one order can read; an undecided file stays M/D/Y, as before.
  - `parseAmount` returns null for non-numbers, where it used to return `|| 0` and the row was dropped.
  - `buildRows` keeps every data row and flags it. Only balance lines and zero-amount lines are left out, and they are counted.
  - `groupProblems`, `summarise`, `importableRows`, `sortProblemsFirst`, `fixableByOtherOrder`.
- `ImportCSVDialog`:
  - Summary strip: Ready · Errors (blocks import) · Warnings (imports anyway) · Likely duplicates.
  - Problems-by-cause panel with a per-cause fix: a D/M/Y | M/D/Y toggle for dates, and "Skip these rows" / "Import these rows again".
  - Row table: problems first, "Only problems" filter, windowed with `useRenderWindow` (60 rows at a time).
  - The Import button reads "Fix or skip N error rows" while any error is unresolved.
  - The dialog is `max-w-3xl`, and the table scrolls sideways on a phone.

## Acceptance criteria
- Error / warning / duplicate counts as a summary strip: PASS (counts unit-tested).
- Fixing a cause clears every row under it: PASS. Switching the date order and skipping a cause are unit-tested.
- Errors block the import, warnings don't: PASS (unit-tested).
- Problem rows sort first: PASS (unit-tested).
- "Only problems" filter: PASS by code.
- Duplicates default to skip, flagged and unticked, name the matched row, per-row opt-in: PASS (lib unit-tested, UI by code).
- Lint, build and test pass: 191 tests, 21 new across LED-73 and LED-65.

## Issues found in validate
- [FIX NOW, fixed] The row window didn't reset for a new file with the same row count; it now resets on a per-load `fileKey`.
- [FIX NOW, fixed] The duplicates tile read "0" when the check had failed; it now reads "—".
- [FIX NOW, fixed] The two-column mobile strip drew a top border on the second tile (`divide-y`); it now uses `gap-px` hairlines.
- [FIX NOW, fixed] The table could widen the dialog on a phone; its wrapper is now `overflow-x-auto`.

## Behaviour change
Rows that were silently dropped now surface. A file with a footer "Total" line (amount, no date) shows it as a date error to skip, and the import is blocked until you skip it. This is intended: the AC say errors block.

## Backlog
- Not verified live. Signing in means entering a password, which the agent doesn't do. A local test user `validate-led65@example.test` exists, with account "Everyday Checking" and 3 transactions, plus a 160-row test CSV in the session scratchpad. Unconfirmed in a browser:
  - strip and panel layout at 375 / 768 / 1280
  - the D/M/Y toggle re-running the duplicate check once the span changes
  - scroll-growing the window inside the dialog's own scroll container
- "No category match" cause (the mock's 19): waits on LED-74.
- The mock's "Step 3 of 4" wizard framing and its Back button: not built.
- A mix of ambiguous slash dates (all parts ≤ 12) still defaults to M/D/Y silently. Flagging an "ambiguous date order" warning would catch D/M/Y files that never go above the 12th.
- LED-75 still owns the account auto-pick (`accounts[0]`), currency mismatch and transfers.
- Ticket CSV statuses are not updated (same as earlier epics, which were marked done in a follow-up docs commit).
