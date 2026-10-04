# LED-236 · A category can count as salary — retro (2026-10-04)

Branch `epics-15-19`. Epic 21, phase B. Decision OD-13 item 4: salary is a per-category flag the user sets, not a guess from the name.

## What was built
- **Migration `20261004110000_category_counts_as_salary.sql`.**
  - `categories.counts_as_salary boolean not null default false`.
  - Backfill with `~* '\y(salary|salaries|wages?|basic pay|payroll)\y'`, the app's old JS pattern. On ten sample names (Salary, Monthly salaries, Wage(s), Basic Pay, ACME payroll, Salaryman, Bonus, "Basic  pay", Overtime) SQL and JS agree on every one.
  - `handle_new_user()` re-created from the baseline body with the default Salary row flagged, so new users and the seed's demo user get it.
- **`src/lib/thirteenthMonth.ts`.** `salaryOnlySelection(records, salaryCategoryIds)` and `pd851Checklist(records, included, salaryCategoryIds)` read a set of flagged category ids. `isSalaryCategory` and the name pattern are gone. The overtime, allowances and other patterns stay: they only warn about ticked records.
- **`ThirteenthMonthPage.tsx`.** Builds the set from `useCategories`. While categories are loading, or failed with nothing cached, Auto-select is disabled and the failure shows with Retry. With no category flagged, a line points to Categories. `useTransactions` is unchanged.
- **`CategoryForm`.** A "Counts as salary" switch (the `Switch` the budget form uses for rollover), shown for income and both. Saving as expense clears it.
- **Tests.** `thirteenthMonth.test.mjs`: the name test is replaced by "the flag decides, not the name" and "renaming a flagged category keeps it salary"; the rest pass the set.

## Acceptance
- **(a) The migration flags today's matches and applies to an empty database: PASS.** Local: the 5 "Salary" categories flagged, nothing else. A new auth user in a rolled-back transaction gets Salary flagged and the other income defaults not. The from-scratch replay runs at validation.
- **(b) The 13th Month page reads the flag: PASS.** Browser, demo user: Freelance flagged in Edit Category, then Auto-select salary only reads "8 of 12 counted as basic salary", which matches SQL (Salary 6 + Freelance 2); Investment and Gift are excluded. Freelance reset afterwards.
- **(c) A renamed flagged category keeps it: PASS.** psql under RLS: Salary renamed to "Main job" keeps `counts_as_salary = true` (rolled back). Unit test too.
- **(d) Tests: PASS.** 908 passing.

## Deviations
- **A switch, not a checkbox.** The plan said checkbox; the form library's nearest toggle is the `Switch` used for rollover.
- **The page reports a category read failure.** Not in the plan, but without the categories the flag can't be read, and AGENTS.md says read failures are shown.

## Backlog
- **Category icons show as boxes in this dev browser** (Edit Category, the list). Likely the same encoding issue as LED-247; not checked.
