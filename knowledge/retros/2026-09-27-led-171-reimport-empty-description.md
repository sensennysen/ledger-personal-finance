# LED-171 · Re-import matches the description-less row — retro (2026-09-27)

## What shipped
- `matchDuplicates` (`importDuplicates.ts`) now substitutes `EMPTY_DESCRIPTION` ("No description") for an incoming row's blank description before building its match key, the same substitution `ImportCSVDialog` applies when it actually saves the row. Both sides of the comparison now normalise the same text.

## Acceptance (live re-run: headless Chrome over CDP, seeded user, a 3-row CSV with one empty-description row, imported twice into Checking)
- (a) Import a file with an empty-description row, import it again: 0 ready, all duplicates: **PASS, live**. First import: "3 rows parsed … READY 3", one row saved as "No description". Re-importing the identical file: "READY 0 … LIKELY DUPLICATES 3", with the empty-description row's own line reading "No description — already in Ledger — Matches 2026-09-11 · No description · $8.00".
- (b) unit test in `tests/importDuplicates.test.mjs`: PASS.
- (c) other duplicate behaviour unchanged: PASS — the other two rows (with real descriptions) also matched as duplicates as before; the full file (42 cases) and the full suite (739 cases) still pass.

## Backlog
- None outstanding for this ticket.
