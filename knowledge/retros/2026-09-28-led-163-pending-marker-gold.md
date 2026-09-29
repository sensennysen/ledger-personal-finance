# LED-163 · "Not synced yet" marker is indigo, not gold — retro (2026-09-28)

## What shipped
- Swapped `text-primary` → `text-warning` at the two reported sites: `TransactionRow.tsx:140` and `DashboardRecentTransactionsCard.tsx:86`. `grep -rn "Not synced yet" src` confirms these are the only two.
- Did **not** add either file to `semanticTokens.test.mjs`'s existing blanket `STATUS_FILES` list — both files have other legitimate, unrelated `text-primary`/`accent-primary` uses (a hover link, a checkbox accent, another inline link) that a whole-file ban would wrongly flag. Instead added a narrow test per file: find the "Not synced yet" line, check the one-line block around it for `text-warning` and not `text-primary`.

## Acceptance
- (a) Marker renders gold in light and dark with ≥4.5:1 contrast: **PASS, already measured.** `tests/themeContrast.test.mjs` already registers `['--warning', '--card']` (the row/card background both markers sit on) in its 4.5:1 pair list, and that test passes (53/53) — no new contrast work needed since `text-warning` is an existing, already-vetted token.
- (b) Guard test lists both files: **PASS.** `tests/semanticTokens.test.mjs`'s new `PENDING_MARKER_FILES` block.
- (c) Offline banner and marker match: **PASS.** `OfflineBanner.tsx`'s pending state uses `color: 'var(--warning)'`; `text-warning` resolves to `var(--color-warning)` → `var(--warning)` (`src/index.css:181`) — the same token.
- Lint, build, full test suite (756 + redesign checks): PASS.

## Backlog
- None — this one was fully verifiable by code and existing tests, no live check needed.
