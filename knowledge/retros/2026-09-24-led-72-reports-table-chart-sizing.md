# LED-72 · Table and chart sizing — retro (2026-09-24)

## What shipped
- `src/lib/chartTicks.ts` `abbreviateTick` (8k, 12.5k, 1.2M, −4k). Both Reports y-axes use it in a 40px gutter (it was 72px).
- The Income vs Expenses card is `h-full` and its chart is `flex-1 min-h-52 lg:min-h-72`, so it stretches to its row partner. The net worth chart is `h-52 md:h-72 xl:h-80`.
- `src/lib/reportColumns.ts`: seven columns (a Type column is new). Date, Description and Amount are required. The default is all seven at md+ and the required three below md. A "Columns" menu toggles the optional ones. The choice lasts the session only (LED-21 precedent). The category sub-line shows only when the Category column is hidden.
- Gold: the preset chips were already removed (LED-21). Two gold leftovers that didn't mean loans (the trend-card icon and the "Net" total) are now neutral.

## Acceptance
- Charts fill their row with abbreviated ticks: PASS (code).
- All seven columns plus a Columns control: PASS (code).
- No gold for "selected": PASS.

## Issues found in validate
- At tablet width the seven columns (~850px) overflow ~720px, and `ScrollArea` drew only a vertical bar. Added an opt-in `horizontal` prop and used it here (`1001bdf`). The other 9 callers are unchanged.
- The test caught `abbreviateTick(950)` returning "1k". The unit is now chosen from the rounded whole value.

## Backlog
- Not verified live (OAuth). Unconfirmed: the chart matching its row partner at lg, and the horizontal scrollbar.
- The column set is seeded once from the viewport. Rotating a tablet doesn't re-seed it.
- CSV/PDF export ignores the Columns choice. That is fine for now, and LED-89 reuses the exporter.
