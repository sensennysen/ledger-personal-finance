# LED-81 · Split dialog — retro (2026-09-24)

## What shipped
- `src/lib/splitState.ts`: `resolveSplit(total, lines)` (pure, 6 tests) returns the difference to the cent, `unassigned` / `overAllocated`, and each blocker: `unbalanced`, `blank-description` (with line indexes) and `zero-amount` (with line indexes).
- `SplitTransactionDialog`:
  - The remainder shows as one button, "$9.40 unassigned → Add as a line", which reuses `addLine`, seeded with `unassigned`.
  - Lines are grid rows (# | description | category | amount | remove) under a header row, in a 720px dialog. Below sm the description wraps onto its own row.
  - Over-allocation reads "$X over the transaction total"; the "over budget" wording is gone.
  - Copy: "The original transaction is deleted and replaced by N entries. This can't be undone." When the original has a receipt or tags, it adds "Its receipt and tags won't carry over."
  - A disabled Split lists each cause next to the button (`aria-describedby`). After the first edit, the lines involved are marked `aria-invalid`.
  - The title is sentence case ("Split transaction"), with the design's subtitle. The button reads "Split into N".

## Acceptance
- "$9.40 unassigned → Add as a line" surfaced directly: PASS.
- Lines render as rows, not cards: PASS in code. Not seen live.
- Over-allocation copy no longer mentions Budgets: PASS.
- The dialog says the delete-and-rewrite can't be undone: PASS.
- Each disabled-Split cause shown separately: PASS. Unit-tested, including all three at once.
- Lint, build and test pass.

## Issues found in validate
- [fixed in 69e950a] The carry-over copy used a curly apostrophe next to straight ones elsewhere.

## Backlog
- Not verified live (Google OAuth sign-in). Unconfirmed: the row layout at 390, 768 and 1280, and the Select trigger truncating in the 11rem column.
- `handleSplitConfirm` still drops tags, receipt and subcategory, and writes lines one at a time before deleting the original. A failure halfway leaves partial lines plus the original. The dialog is honest about the loss now, but carrying tags over and making the write atomic (an RPC) would be better.
- The 13a proportion bar (a stacked category-coloured bar) is not built; it's not in the acceptance criteria.
