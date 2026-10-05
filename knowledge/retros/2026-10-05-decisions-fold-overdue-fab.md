# Owner decisions: phone fold, overdue rows, the FAB — 2026-10-05

| # | Question | Decision |
|---|---|---|
| A | LED-145 (b): what "the first four Home widgets fully above the fold at 390×844" means | **Fit for typical data.** LED-202 made the first four fit with the default order and ordinary data. A card reminder line, a second card, an alert, the first-run checklist or an unrated note may push Budget Progress below the fold; that is accepted. LED-145's other criteria passed in its retro, so it is Done. |
| B | LED-173 (c): Accounts' Coming up lists one row per loan account (earliest deadline), Home's Upcoming Bills one row per purchase | **Keep both.** Accounts is the per-account summary, Home the per-purchase detail. The amounts already agree (the LED-173 retro). No change. |
| D | The phone add button covers content (LED-202 backlog) | **Hide it while scrolling down**; it returns on an upward scroll and at the top, and still hides at the end of a list (LED-34). `hiddenByScroll` in `src/lib/scrollEnd.ts`, tested. |

C (sign-out and browser data) became "keep personal data in the database"; planned separately.

## Verification of D
- `tests/scrollEnd.test.mjs`: 3 new cases. `pnpm lint`, typecheck pass.
- Browser pane at 375×812 on Home, scrolling `main`: top → shown; down to 300 → hidden; up to 200 → shown; a 4px jitter → unchanged; end of list → hidden; back to top → shown.
