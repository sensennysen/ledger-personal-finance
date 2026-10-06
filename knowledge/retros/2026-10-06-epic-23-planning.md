# Epic 23 planning — retro (2026-10-06)

## What shipped
- `docs/dev-tasks/ledger-ui-redesign/epic-23-post-release-followups-tasks.csv`: 15 tickets (LED-277 to LED-291, 23 points), drafted from the Backlogs of the four epic 22 phase retros, each checked against the code first.
- `epic-23-build-order.md`: three phases, two owner decisions (LED-277, LED-279), owner checks after the epic 22 merge.
- `epic-22-post-release-backlog-tasks.csv`: LED-263 to LED-276 and the epic row set to `Done`. Only `STATUS` changed.

## Validation
| Check | Result |
|---|---|
| Header is the 20-column schema; every row has 20 cells | PASS (both files) |
| `STATUS`, `PRIORITY`, `ROLE` from the allowed sets; labels have no spaces | PASS |
| Every `DEPENDENCIES` ID exists in a `docs/dev-tasks` CSV | PASS |
| IDs LED-277 to LED-291 in order; build-order summaries and points match the CSV | PASS |
| No BOM; CRLF like the epic 22 file | PASS |
| Epic 22 diff touches `STATUS` only (15 rows) | PASS |
| `pnpm lint`, `pnpm build`, `pnpm test` (1,096) | PASS |

## Finding
- **The epic 22 CSV was not updated as phases shipped.** Phases 2 to 4 each closed with a retro, but the tickets stayed `To Do` until this pass. A later `/evaluate` reads that column. Set a ticket's `STATUS` to `Done` in its own commit, or in the phase retro commit at the latest.

## Backlog
- **Owner checks after the epic 22 merge:** LED-258 (b), a forced error shows as a row in `error_events`; LED-259 C5, the signed-in production console is clean.
- `/dev-tasks-planner`'s ARCH-doc prerequisite and its Blocked/Fallback/Day-1 rules do not fit this repo (see `2026-09-18-dev-tasks-csv-from-design-handoff.md`); the epic 22 precedent was followed instead.
