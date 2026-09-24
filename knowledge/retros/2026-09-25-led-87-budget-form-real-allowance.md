# LED-87 · Budget form shows the real allowance — retro (2026-09-25)

## What shipped (`a035236`)
- `budgetAllowance(base, carriedIn, rolloverActive)` and `nextCycleOpensAt(base, carriedIn, spent, rolloverActive, behaviour)` in `src/lib/budgetRollover.ts` (8 new tests). They do the same arithmetic as `useBudgets`: the surplus is taken against the base, not the effective limit, and the effective limit is never below 0.
- When rollover is on, BudgetForm shows three figures side by side: Base limit, Carried in, Effective this period. Base follows the Amount field live. Carried in comes from the saved budget; if the amount or the switch differs from what's saved, the form says it updates after you save.
- The rollover help text names what the active deficit setting does: carry uses the 23a wording, reset says overspend isn't subtracted, and non-monthly budgets say the setting has no effect.
- Editing an overspent budget shows "You went over this cycle", "This cycle" and "Next cycle opens at", plus "reduced", "fresh start" or "plus carried surplus", and a "Change this setting" link to /settings. It doesn't render while the setting is still loading.
- The helper that contradicted D1 ("Carry surplus (or debt)"), flagged in LED-20's Backlog, is gone.

## Acceptance
- Base limit → carried in → effective: PASS. Browser (carry): $600.00, −$142.30, $457.70, which is the 23a figure. A new budget shows $0 carried.
- Names the active deficit behaviour: PASS. "Your setting is Reduce next cycle's budget" with the next cycle at $557.70 (carry); the reset wording was checked with the setting switched.

## Decisions
- The copy follows the code, not 28a's "the two work independently". See `rules/deficit-setting-needs-rollover.md`.
- No month name. "Next cycle opens at" replaces 28a's "October opens at", which clears the LED-20 Backlog item about the hard-coded month.

## Backlog
- The form doesn't replay history, so Carried in is shown as it stands after the last save. Replaying would need `useBudgets`' history loop moved into `src/lib`.
- 28a draws the deficit panel for a reset user with rollover off. Under the current code that user never carries anything, so the panel says "Rollover is off, so nothing carries". If D1 is meant to apply without rollover, `useBudgets` has to change, not the form.
