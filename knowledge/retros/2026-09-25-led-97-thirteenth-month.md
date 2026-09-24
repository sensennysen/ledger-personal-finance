# LED-97 · 13th Month — retro (2026-09-25)

## What shipped (`918a1b9`)
- `src/lib/thirteenthMonth.ts` (4 tests):
  - `isSalaryCategory`: word match on salary / wage / basic pay / payroll.
  - `salaryOnlySelection`.
  - `excludedByCategory`: records with no category count as "Uncategorised".
  - `groupByMonth` and `monthKey`, moved out of the page.
- The estimate is stated once, in the hero, with "Across N of M months". The three SummaryCards and the table footer are deleted.
- Months start open. `expanded` became `collapsed`, so a month that loads later also opens.
- Auto-select salary only / Select all / Clear, plus "Excluded by category" chips. All of them write through `updateIncluded`, so the localStorage selection stays the source of truth.
- Copy says the selection is "saved on this device only".

## Acceptance
- Estimate shown once: PASS. In the browser at 1920 and 390, $4,800.00 appears exactly once after salary-only.
- Months expanded by default: PASS. All 21 checkboxes render on load.
- Auto-select salary only: PASS. Seeded data (18 salary, bonus, freelance, uncategorised) gives "18 of 21", chips "Bonus · 1 / Freelance · 1 / Uncategorised · 1", and $57,600 ÷ 12. Persisted as 18 ids.

## Backlog
- 15a's 12-bar "Included by month" coverage strip (partial vs missing vs future months).
- 15a's PD 851 tick/cross checklist in place of the info paragraph.
- Salary matching is by category name only. A user who renamed "Salary" (e.g. "Sweldo") gets nothing ticked. A per-user "counts as salary" category flag would fix it; that is a product decision.
