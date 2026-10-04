# LED-71 · Comparisons on every stat card — retro (2026-09-24)

## What shipped
- `src/lib/periodCompare.ts`: `previousCycleKey`, `cycleMonthLabel`, `summarizeRange` (the page's totals now use it too), `netWorthEffect` (the net worth rollback now uses it too), `compareToPrevious`, `formatComparison`.
- Income, Expenses and Net Change show "↑ 11.8% vs Aug", coloured by whether that direction is good news for the figure. Net Worth shows "↑ $1,132.80 this cycle". Net Change's sub-line reads "Surplus · N% of income kept".
- Comparisons are hidden when a read failed, so partial data can't show a false "↓ 100%".

## Acceptance
- Every stat card shows a vs-previous-period comparison: PASS (code).
- "Derived from existing monthlyData": deliberately NOT followed. `monthlyData` is the trend lookback, and LED-21a forbids the stat cards from reading it. The comparison reads the previous *cycle* instead.

## Issues found in validate
- None. Apply-time fixes: a `-0` from a transfer with no fee (caught by the test), and a React compiler memo error from a derived dependency.

## Backlog
- The current, partial cycle is compared with the whole previous one (Sep 1–11 vs all of Aug), as design 9a shows. A like-for-like option (same elapsed days) needs a product decision.
- Net worth change, like the existing net worth chart, ignores `exchange_rate` and includes inactive accounts' transactions.
- Not verified live (OAuth).
