# LED-143 · Deletion export completeness — retro (2026-09-26)

## What shipped
- `src/lib/runningBalance.ts`: `buildRunningBalanceMap(accounts, transactions)`. It unwinds from live balances and mirrors `update_account_balance` (`20260810120000_add_loan_tracker.sql`): an expense with a target credits it only when it is a loan; a transfer's destination is credited `amount x rate`. The old inline code in `ReportsPage` ignored the loan credit and dropped the rate. Ties on date and time now break on id.
- Reports uses the shared function; so does the export, so **Standing Balance is filled**.
- `src/lib/dataExport.ts`: accounts, categories and budgets CSVs and `exportFileName(kind, localDate)`. The deletion card offers one file each (no zip, so no dependency), with its own read and `resolveLoadState`; a failed read shows the error and no button. Transactions also fail when accounts fail, since the balances need them.
- **CSV cells:** `escapeCsvCell` prefixed every value starting with `-`, numbers too, so a card's `-3450.75` would have exported as `'-3450.75`. Only strings are neutralised now.
- Files are named `ledger-export_<kind>_<local date>.csv` (the transactions file used to be `ledger-export_<date>.csv`).

## Found in the live check
The card crashed the page for a signed-in user: `useAccounts` needs `NotificationProvider` and `/data-deletion` is outside the layout. Fixed by wrapping the card; `patterns/hooks-on-public-pages.md`.

## Acceptance
- (a) Standing Balance filled and equal to the account's ledger balance at each row: PASS. Test replays the trigger's rules forward and compares every row; live, Main Bank's newest row is 68,350 = the account, and the card's -3,450.75 row matches its history.
- (b) Accounts, categories, budgets exported: PASS live (3, 15, 1 rows).
- (c) File names use the local date: PASS live (`...2026-09-26.csv`).
- (d) A failed read shows an error and no partial file: PASS live (categories and accounts blocked: three errors, only Export budgets left).
- (e) Reports uses the same function: PASS.
- (f) Lint, build, test: PASS (617).

## Backlog
- Reports' running balance was not compared before and after on a large account; the Reports page shows 68,350 / 69,350 / 69,800 / -3,450.75 / 70,000 for the seeded rows.
- `useBudgets` returns active budgets only and does a 13-month spend read the export does not need; inactive budgets are not exported.
- Transfers show the Standing Balance of the source account only; the receiving account's balance has no column.
- `netWorthData` in Reports still has its own unwinding (net worth, not per-account) and was not touched.
- The "Export my data (N)" wording changed to per-file buttons; the page copy was not re-read with LED-142 (OD-5).
