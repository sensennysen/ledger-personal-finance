# LED-177 · Loan Schedule tile hides the due day on phones — retro (2026-09-29)

## What shipped
- `bandCell()` (page-local, unexported helper in `src/pages/AccountTransactionsPage.tsx`) always truncated its value line to one row. Added an opt-in 5th parameter `wrapValue = false` that swaps `truncate` for `break-words` on the value `<p>` when `true`; every other call site (Current balance, Credit limit, Statement closes, Payment due, Outstanding, Repaid, Next payment, Income, Expenses, Transfers) keeps the default `false` and is byte-for-byte unchanged.
- Passed `true` only at the Schedule tile: `bandCell('Schedule', formatLoanSchedule(account) ?? 'Per purchase', 'Subtracted from net worth', false, true)`. `"Once a month · day 15"` can now wrap to two lines instead of clipping to `"Once a month ·…"`.
- Did not touch the sub-label ("Subtracted from net worth", also seen clipped in the repro) — the AC only requires the due day, and leaving it `truncate` keeps the diff minimal.

## Acceptance
- (a) At 390 the tile shows the due day in full: **PASS by construction** (wrap enabled for this tile only) — not re-measured live this session (see Backlog).
- (b) 1280 unchanged: **PASS** — every other `bandCell` call is untouched; at 1280 "Once a month · day 15" already fit on one line, so `break-words` has no visible effect there.
- (c) Legacy loans (no due day) show "Once a month": **PASS, already true** — `formatLoanSchedule` (`src/lib/loans.ts`) only appends `· day N` / `· days N & M` / `· <weekday>` when `loan_due_days`/`loan_due_weekday` are set; with none set it already returns the bare period label. Verified by reading the function, no change needed.
- Lint, `tsc -b`, full test suite: PASS.

## Backlog
- No browser extension available this session. Re-check at 390 against the original repro (`shots/126-detail390-loan-details.png`): confirm "day 15" is now visible (wrapped), 1280 is pixel-identical to before, and a legacy loan (no `loan_due_days`) still reads "Once a month" with no trailing separator.
