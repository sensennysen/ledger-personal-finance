# LED-20 — `budget_deficit_behaviour` setting

## Pattern
The setting lives on `profiles` and `useBudgets` derives it from `useAuth().profile` (falling back to `'carry'` until the profile loads), so `BudgetsPage` and `DashboardPage` cannot disagree. The radio figures come from `deficitOutcome()`, which reuses `nextRollover`, so the UI and the real rollover cannot drift.

## Decisions
- Migration adds the column with default `'carry'` (existing rows backfill), then `set default 'reset'` for new rows. Guarded, so re-running never re-backfills. Checked in a rolled-back transaction: existing profile -> `carry`, new profile -> `reset`, second run a no-op.
- `deficitOutcome(budget, spent, behaviour)` takes *spent*, not overspend. The spec's "$900 against $600 opens at $0, $300 uncarried" means an overspend of $900 (carry clamps at -$600).
- No radio primitive exists in `components/ui`; native radios in a `fieldset`, no new dependency.
- Radio figures use the design's fixed worked example ($742.30 spent against $600), not the user's own budgets.

## Backlog
- Manual browser check of Settings -> Budgets (radio save, error path, revert on failure) not run; no browser in the session.
- "The overspend is recorded in Reports" is dead copy until LED-23 ships the Overspending section.
- The example month name "October" is hard-coded from the design; make it relative when the real figures land.
- BudgetForm helper "Carry surplus (or debt)" still contradicts D1; belongs to LED-86/87.
- Settings save is not offline-queued; a failed write shows an inline error and the radio stays on the stored value.
- Existing-row profiles missing the field (older cached profile) fall back to `'carry'`, which matches the upgrade rule.
