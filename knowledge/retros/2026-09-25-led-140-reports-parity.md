# LED-140 · Reports: Over budget card, phone label, breadcrumb, export follows Columns — retro (2026-09-25)

## What shipped
- `useOverspendingReport` (one read, this cycle and last); `OverspendingCard` takes the report as a prop, so the card and the new stat card cannot disagree.
- An "Over budget" `StatCard` (total in the display currency, "N categories", a comparison against last cycle). The grid is `lg:grid-cols-3 xl:grid-cols-5`.
- The 13th Month link reads "13th Mo" below `lg` and "13th Month Pay" from `lg`, with the full name as its accessible name.
- `Reports > 13th Month Pay` breadcrumb on the standalone page, same markup as the account page's.
- `exportColumns` (pure) and `buildReportCsv`; the PDF table is built from the same columns, in table order, with Type and Balance now available.

## Decisions
- **Net Worth stays.** 28a draws Income, Expenses, Net Change and Over budget, but nothing says to remove Net Worth, so Over budget is a fifth card.
- **The "Overspending history" link is omitted.** The Overspending card sits directly below the header on the same page, so there is nowhere further to go.
- **`buildReportCsv` is a sibling function**, not a parameter on `buildTransactionsCsv`, so the LED-89 deletion export and LED-143 cannot change by accident. A test pins its 12 headers.
- The label breakpoint is `lg` (9a draws "13th Mo" at 768 as well), not the ticket's "phone".
- Amount always exports with its Currency column.

## Acceptance
- (a) Over budget card with a comparison, follows the stepper: PASS live (Sep $160.30, 2 categories, "Nothing in Aug to compare"; Aug $0.00, "Same as Jul").
- (b) Phone label "13th Mo": PASS live at 375 (accessible name "13th Month Pay").
- (c) Breadcrumb links back to Reports: PARTIAL. It renders on the page; the link click was not exercised.
- (d) CSV and PDF honour the visible columns: PARTIAL. CSV PASS live (all seven columns, then Account unticked: `Date,Description,Category,Type,Amount,Currency,Standing Balance`). The PDF ran without an error; its contents were not opened.
- (e) Overspending history link decision recorded: PASS (above).
- (f) Lint, build, test: PASS (589/589).

## Backlog
- Open a generated PDF and check the column layout at five, seven and three columns.
- `exportToPdf` still takes eleven positional arguments.
- The trend charts' own lookback and the like-for-like previous period are unchanged (Parked).
