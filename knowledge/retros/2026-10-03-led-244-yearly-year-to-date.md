# LED-244 · A yearly budget is labelled year to date — retro (2026-10-03)

Branch `epics-15-19`. Epic 21, phase A. Decision OD-13 item 12: the figures stay cumulative for the year, and the row says so.

## What was built
- **`spendWindowLabel(period)`** (`src/lib/overspending.ts`): "year to date" for a yearly budget, null for weekly, monthly and quarterly. It is the one source of the wording.
- **`OverspendingRow.period`.** Each row carries its budget's period.
- **Overspending card.**
  - A yearly row reads "$6,600.00 of $5,000.00 · year to date". The phrase doesn't wrap.
  - Its Cycles chip reads "This year", neutral, instead of a streak. A yearly budget always reported "1st", which meant nothing.
  - On phones, the label replaces the inline streak.
- **Budget list.** The table puts "year to date" under the Spent figure. The phone card reads "$6,600.00 spent · year to date".
- **Test** (`overspending.test.mjs`): with a yearly and a monthly budget, the yearly row carries `period: 'yearly'` and the year's spend (1,200, not September's 300). Only yearly gets the label.

## Acceptance
- **(a) Yearly rows in Overspending and the budget list carry the label: PASS.** Measured with a local yearly budget on the demo user (Housing & Rent, $5,000, deleted afterwards):
  - Reports @390: "$6,600.00 of $5,000.00 · year to date"; @1280: the same, with the "This year" chip.
  - Budgets @390 (card): "$6,600.00 spent · year to date"; @1280 (table): "$6,600.00" over "year to date".
- **(b) Cycle budgets are unchanged: PASS.** The label is null for every other period, so their markup is identical (test). The demo user's monthly budgets render as before.
- **(c) Checked at 390: PASS.** No sideways scroll. Screenshot: the label sits on its own line under the amounts.
- `pnpm lint`, `tsc -b` and `pnpm test` (878 passing, plus `tests/redesign.mjs`) are green.

## Deviations
- **The streak chip** for a yearly row now reads "This year". The ticket asked only for the label. The chip's "1st" contradicted it.
- **No window mismatch.** The plan expected a Budgets vs Overspending mismatch for past cycles. Both take the yearly range from `getBudgetCycleRange`, so there is nothing to file.

## Backlog
- **Weekly and quarterly rows** in Overspending also show a meaningless "1st" streak, and their window isn't the cycle either. Not in OD-13's scope.
