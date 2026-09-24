# The deficit setting only matters when rollover is on
`useBudgets` and `computeOverspending` only accumulate a carried amount for budgets with `rollover_enabled` on a monthly period. `budget_deficit_behaviour` only changes what `nextRollover` does with that amount.
**Why:** design 28a calls the setting and the rollover toggle independent. In the code, a budget with rollover off opens every cycle at its base whatever the setting (found in LED-87).
**How:** any copy or figure about the deficit setting checks rollover first (`nextCycleOpensAt` returns the base when rollover is off). Don't tell a rollover-off user that an overspend will reduce next cycle.
