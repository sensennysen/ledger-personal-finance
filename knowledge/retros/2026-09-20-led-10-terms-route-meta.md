# LED-10 — /terms has no routeMeta

## Done
- `App.tsx`: added a `/terms` entry to `routeMeta` ('Terms of Service') beside `/privacy` and `/data-deletion`. Description drawn from the Terms page sections (eligibility, responsibilities, data & privacy).

## Learned
- `routeMeta` tests are exact pathname matches, so entry order is irrelevant.

## Backlog
- `routeMeta` has no automated test; a missing legal route would regress silently.
- Other legal-page items remain open under spec §5.11 (cross-links, CSV export beside deletion, shared skeleton).
