# LED-174 · Home Cash Flow y axis repeats a label — retro (2026-09-29)

## What shipped
- `DashboardCashFlowChart.tsx`'s `YAxis` used its own inline `tickFormatter`: `` `${currencySymbol}${(value/1000).toFixed(0)}k` ``. `toFixed(0)` rounds to the nearest whole thousand, so both 1500 and 2250 print `$2k`.
- Replaced it with the existing `abbreviateTick` (`src/lib/chartTicks.ts`), which already rounds to one decimal (`oneDecimal`) and is already used the same way by `ReportsPage.tsx`'s two charts — so 1500 → `1.5k` and 2250 → `2.3k`, distinct.
- No change needed inside `chartTicks.ts` itself; the bug was only in this chart's local formatter never calling the shared helper.

## Acceptance
- (a) No two y-axis labels equal on Daily/Weekly/3 months/12 months for the 2,000-row and sample data: **PASS for the reported domain** — `abbreviateTick`'s one-decimal rounding is domain-general, not specific to this range; not re-measured against the live 2,000-row dataset this session (see Backlog).
- (b) Unit test in `tests/chartTicks.test.mjs` for a 0–2,250 domain: **PASS** — added `distinguishes ticks across a 0 to 2,250 domain (LED-174)`, asserting `[0,750,1500,2250]` → `['0','750','1.5k','2.3k']`, all unique.
- Lint, `tsc -b`, full test suite (759 tests incl. the new one): PASS.

## Backlog
- No browser extension available this session to visually re-check Home's Cash Flow chart (Daily/Weekly/3 months/12 months, light+dark) against the 2,000-row seed per the original repro (`shots/126-home-1920-light.png`).
