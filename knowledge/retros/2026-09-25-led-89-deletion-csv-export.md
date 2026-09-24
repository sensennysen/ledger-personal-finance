# LED-89 · CSV export beside the deletion instructions — retro (2026-09-25)

## What shipped (`bf3689a`, fix `bb84d83`)
- `src/lib/transactionCsv.ts` (5 tests): `escapeCsvCell`, `TRANSACTION_CSV_HEADERS`, `buildTransactionsCsv(txs, balanceMap?)` and `downloadCsv`. They were moved out of `ReportsPage.tsx` with the logic diffed line by line; Reports now calls them.
- `src/components/legal/ExportDataCard.tsx`, in LegalPage's `aside` on /data-deletion:
  - Signed out (the page is public): "Sign in to export".
  - Signed in: `useTransactions()`, which already pages past 1,000 rows, then "Export my data (N)".
  - The button is disabled while loading. The error and stale-error states show a retry and no button, so a failed read never downloads an empty or stale file.
- Fix: the filename used `toISOString()` (UTC) and was named after yesterday before 8am in Manila. It now uses `getLocalDateString()`. The browser check caught this; unit tests couldn't.

## Acceptance
- CSV export on the data-deletion page, reusing the Reports exporter: PASS.
  - Browser, signed in: `ledger-export_2026-09-25.csv` with 22 rows plus the header; `=SUM(A1)…` is exported as `'=SUM(A1)…`.
  - Reports export is unchanged: `ledger-report_2026-09-01_to_2026-09-30.csv` still has Standing Balance.
  - Blocking `rest/v1/transactions` shows "Couldn't load your transactions…" with Retry and no export button.

## Backlog
- Standing Balance is blank in the deletion export. Filling it needs the per-account running-balance logic that ReportsPage computes inline, moved into `src/lib`.
- The export covers transactions only. Accounts, categories and budgets aren't exported, although the page lists them as data we hold.
