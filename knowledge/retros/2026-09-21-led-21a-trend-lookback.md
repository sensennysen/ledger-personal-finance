# LED-21a — Trend-chart lookback

## Pattern
`src/lib/reportLookback.ts` is pure: `getLookbackBuckets(lookback, today)` returns contiguous `{start, end, label}` buckets, oldest first, the last ending today; `getLookbackSubtitle` builds "Last 90 days · Jun 19 – Sep 17 · weekly". Unit-tested in `tests/reportLookback.test.mjs`. `ReportsPage` keeps `lookback` in plain `useState` (session only) and feeds it only to `monthlyData`, which sums income and expenses per bucket.

## Decisions
- Bucket size adapts: 30d daily (30 buckets), 90d weekly (13 x 7 days, working back from today so none is partial), YTD and 12m monthly (current month ends today).
- The Overview and Analytics tabs rendered the same chart twice; both now use a local `IncomeExpenseCard`, sharing one `lookback` state. The selector (native `<select>`) sits on the card header, never the page header.
- Stat cards, transaction table and category breakdown are untouched and stay on the stepper's cycle.
- Net Worth Over Time was left at 13 months monthly: it is a point-in-time balance and the ticket and 30a design only specify income vs expenses.
- Followed the ticket and spec D3 over two 2B design notes (L972 "stepper moves the window", L1194 mobile "6 months"), which contradict it.
- Chart title changed from "Monthly Income vs. Expenses" to "Income vs. Expenses", as the bucket is no longer always monthly.

## Backlog
- Manual browser check not run: selector on both tabs, all four ranges, mobile width, tooltip and axis labels with 30 daily ticks.
- Design 30a draws a segmented control and four states at desktop and mobile; a native select was used. Restyle if a pixel match is wanted.
- Net Worth chart does not follow the selector (see Decisions).
- Weekly buckets are trailing 7-day windows, not calendar weeks.
- `getLookbackSubtitle` recomputes from `new Date()` on each render; a page left open past midnight refreshes on the next render only.
- LED-21 and LED-24 changes are still uncommitted in the same working tree, so `ReportsPage.tsx` mixes LED-21 and LED-21a edits.
