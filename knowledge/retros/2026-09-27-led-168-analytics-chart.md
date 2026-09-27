# LED-168 · Analytics Income vs. Expenses chart — retro (2026-09-27)

## What shipped
- `IncomeExpenseCard` (`ReportsPage.tsx`): the chart and its skeleton fill an `absolute inset-0` box inside a `relative flex-1 min-h-60 lg:min-h-72` wrapper.
- Cause: in Analytics the card is a child of a flex column with no definite height, so `ResponsiveContainer height="100%"` resolved to 0 (1178x0). The ticket's suggested `min-h` was already on the wrapper and did nothing for a percentage child.

## Measured (dev server, seeded user with 90 rows)
Chart container, width x height:

| view | before | after |
|---|---|---|
| Analytics 1280 | 1178x**0**, 0 bars | 1178x288, bars 24 / 7 / 18 / 16 |
| Analytics 390 | 320x**0**, 0 bars | 320x240, same bars |
| Overview 1280 | 702x288 | 702x288 |
| Overview 390 | 320x208 | 320x**240** |

Bars are for 12 months, 30 days, YTD and 90 days. The Overview chart at 390 is 32px taller because `min-h-52` became `min-h-60`, to meet the 240px acceptance criterion in both tabs.

## Acceptance
- (a) Bars and axes for 30 days, 90 days, YTD and 12 months at 1280 and 390: PASS (bar counts above; 390 Analytics screenshot checked).
- (b) Container at least 240px: PASS (288 at 1280, 240 at 390).
- (c) Selection shared with Overview: PASS by code (both cards take the same `lookback` state); not clicked across tabs.
- (d) No chart card measures 0 height: PASS for both Reports tabs at 1280 and 390 (every `.recharts-responsive-container`).

## Backlog
- Only Reports was swept for 0-height charts; other pages' charts were not re-measured.
- Dark theme not re-screenshotted (no colour change).
