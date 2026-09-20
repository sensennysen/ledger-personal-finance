# LED-02 — Rollover on non-monthly budgets

- Ticket premise was partly stale: `BudgetForm` already hid the toggle for non-monthly periods. Real gaps were (a) switching a monthly rollover budget to another period still persisted `rollover_enabled: true`, and (b) existing non-monthly rows with `true` still showed the chip / "Rollover enabled" text.
- Decision: one predicate, `canRollover(period)` in `budgetRollover.ts`, used by the hook, form, card and history. The form always shows the row; for non-monthly periods the switch is disabled and off with an inline reason.
- "Not silently mutated": `rollover_enabled` is cleared only when the user changes the period away from monthly in that edit. Untouched legacy rows keep their stored value; display is gated instead.
- Design check: `[23a]` draws only the monthly state; no frame for the non-monthly state. Audit note says "disable it with the reason", `tickets.md` D-table decides disabled.

## Backlog
- Restyle the rollover row to the 23a design (muted row, no icon, D1 copy "Carries a surplus forward. Independent of the setting above.") — belongs to LED-86/87.
- The helper text "Carry surplus (or debt)" contradicts D1; fix with the form redesign.
- Correct the LED-02 CSV/ticket text ("the form renders the checkbox" is no longer true).
- Manual browser verification was not run for this ticket.
