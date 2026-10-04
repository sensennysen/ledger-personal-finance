# LED-234 · Import flags identical rows within one file — retro (2026-10-03)

Branch `epics-15-19`. Epic 21, phase A. Decision OD-13 item 2: mark the rows, keep both ticked, and leave the saved-row duplicate check as it is.

## What was built
- **`findIdenticalRows(rows)`** (`src/lib/importDuplicates.ts`).
  - **What makes rows identical.** Same date, amount (in cents), direction and description. The description is compared as written: trimmed, spaces collapsed, any case.
  - **Result.** Each line maps to the other lines it repeats, in file order.
  - **Skipped and empty rows.** Rows with no date, amount or direction are skipped. A row with no description is compared as `EMPTY_DESCRIPTION`, which is how it is saved.
- **`identicalRowsLabel(others)`**: "Identical to row 3 in this file", "… rows 4 and 9 …", "… rows 2, 3 and 8 …".
- **Import preview** (`ImportCSVDialog`).
  - The note sits under the description, below any "Matches …" line.
  - It is computed on the file's own rows (statement amounts), so a conversion can't split two identical rows.
  - It is a separate map, not a problem cause: nothing is unticked, counted as a problem or sorted differently.
- **Tests** (`importDuplicates.test.mjs`, +6):
  - pairs and triples;
  - each of date, amount, direction and description breaks a match;
  - case and spacing don't;
  - empty descriptions;
  - unparsed rows;
  - the saved-row check is unchanged: two identical rows against one saved row still give one duplicate.

## Acceptance
- **(a) Marked, both ticked: PASS.** Browser at 390 and 1280, a four-row CSV into Cash Wallet. Rows 1 and 3 read "Identical to row 3 / row 1 in this file", and every row stays ticked.
- **(b) Unticking one imports the other: PASS.** At 1280, row 3 unticked, "Import 3 rows", "3 transactions imported". The database held one "LED234 COFFEE KIOSK", the 8842 row and the bookshop. The test rows were deleted afterwards.
- **(c) Rows that differ are not marked: PASS.** Row 2 differs only by the reference number 8842 and is not marked (browser and test). The test also covers date, amount and direction.
- **(d) A pure `src/lib` function with tests: PASS.**
- `pnpm lint`, `tsc -b` and `pnpm test` (884 passing, plus `tests/redesign.mjs`) are green. No sideways scroll at 390.

## Deviations
- **Description comparison.** The plan said to reuse `matchKey`. That key drops digit runs of four or more (`normaliseDescription`), so "COFFEE 8842" and "COFFEE 1190" would count as identical, against criterion (c). The in-file check compares the written description instead, and only case and spacing are ignored.

## Backlog
- **Not counted in the summary tiles.** The rows are not counted in the "Likely duplicates" tile or listed under "Problems by cause". OD-13 asked only for a mark. Revisit if users miss them in long files.
