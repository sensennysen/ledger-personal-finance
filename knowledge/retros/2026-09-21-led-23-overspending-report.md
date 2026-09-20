# LED-23 — Overspending section in Reports

## Pattern
`computeOverspending` (`src/lib/overspending.ts`) is pure and takes raw budgets + expenses, so it is unit-tested under `node --test` (`tests/overspending.test.mjs`). It walks monthly budgets cycle by cycle with `nextRollover`, so the limit and the consecutive-over count match the Budgets page under both settings. `useOverspending` fetches its own inputs (paginated, back to the earliest budget start) so a streak is never truncated by a fetch window, and `OverspendingCard` routes them through `resolveLoadState`: a failed read is an error, never "no overspending".

## Decisions
- LED-21 (global cycle) is not shipped, so the card owns a local cycle stepper (`startDay` from the profile). Swap it for `useMonthCycle` under LED-21.
- `useBudgets` was not reused: it keeps 6 history entries and would cap streaks.
- Streaks and the uncarried figure are monthly-budget only (matches `canRollover`); weekly/quarterly/yearly budgets report the selected cycle with streak "1st".
- Budgets without `rollover_enabled` compare against the base amount; nothing carries, so `uncarried` is 0.
- `uncarried = max(0, -(rollover + surplus) - amount)`, i.e. what `nextRollover`'s clamp at `-budgetAmount` did not absorb. This follows the code: a $1,500 spend on a $600 budget leaves $300 uncarried. The spec's "$900 against $600 -> $300 uncarried" only holds if $900 is the overspend (as read in the LED-20 retro); the two readings are not reconciled by the spec.
- Unconvertible-currency spend is named in a caveat rather than silently understating totals.

## Backlog
- Manual browser check not run (no browser in the session): stepper, empty state, error/retry, `'carry'` and `'reset'` copy.
- Design frames are missing for the empty state, the `'carry'` copy and the uncarried figure; these are my interpretation.
- "Overspending history" link from the design is not built; its destination is undefined.
- The design's fourth "Over budget" stat card is not built; belongs with LED-21's layout.
- Mixed-currency totals render as "A + B" rather than converting.
- The LED-20 "overspend is recorded in Reports" copy is now true; the Settings example still hard-codes "October".
- No component test (repo has no DOM test setup); only the lib is covered.
