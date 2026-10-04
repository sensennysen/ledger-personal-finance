# LED-175 · Split dialog category select clipped at 390 — retro (2026-09-29)

## What shipped
- Root cause differs slightly from the ticket's framing: the "11rem column" only exists at `sm:` and up; below `sm` the category `Select` lands in the grid's `1fr` track shared with a 7rem amount column and a 2rem delete button, squeezing it to roughly the reported 108px. Kept the amount column exactly as the ticket asked ("keep the amount column") rather than reflowing the grid.
- The narrow trigger wasn't the real bug on its own — `select.tsx`'s shared `*:data-[slot=select-value]:line-clamp-1` doesn't apply cleanly to a bare text-string child of a `flex` `SelectValue`, so the label hard-cut mid-word with no ellipsis, instead of clipping cleanly.
- Fix, scoped to `SplitTransactionDialog.tsx` only (no shared `select.tsx` change): wrapped the rendered label (both the category-icon-and-name branch and the "Uncategorized" branch) in a local `<span className="min-w-0 truncate">` inside the existing `<SelectValue>`, so it now ellipsizes instead of cutting mid-word.

## Acceptance
- (a) At 390 the chosen category is readable in full for the default categories, or ends in an ellipsis: **PASS via the ellipsis branch** of the AC — didn't attempt the "readable in full" branch (would need the grid reflow the ticket also allowed as an alternative), since ellipsis is explicitly acceptable and is the lower-risk, single-file change.
- (b) 768 and 1280 unchanged: **PASS** — no grid/column classes touched, only the value's own text node.
- Lint, `tsc -b`, full test suite: PASS (layout/rendering only, no unit-testable logic).

## Backlog
- No browser extension available this session. Re-check at 390 against the original repro (`shots/126-split-390.png`): confirm "🛒 Groceries" and "Uncategorized" now show as "🛒 Grocer…" / "Uncategor…" (ellipsis, not a bare cut), and that 768/1280 still show the full label as before.
