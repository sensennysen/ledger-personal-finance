# Epic 19 · LED-212 — merge route for the phase branches, `.claude/launch.json` — retro (2026-10-04)

Branch `epics-15-19`. One 2-point hygiene ticket in phase 6. Every retro since epics 8 to 13 said the phase branches were unmerged and `.claude/launch.json` was untracked. No code. Nothing was merged, pushed or deleted.

## Route chosen
**The planned `epics-15-19` → `main` PR carries every epics 8 to 13 phase. There is no separate merge of `epics-8-13-phase-13`.**

- Every `epics-8-13-phase-N` branch (1 to 7, 9 to 13; there is no phase 8) is an ancestor of `epics-8-13-phase-13`.
- `epics-8-13-phase-13` is itself an ancestor of `epics-15-19`. A separate merge of the tip would only land a subset of the one PR the owner already plans.
- The owner opens that PR when the remaining `epics-15-19` work is finished. This ticket does not open it.

## What was done
| Change | Detail |
|---|---|
| `.claude/launch.json` tracked | It holds only the `ledger-dev` preview config (`pnpm dev --port 5173`), with no secrets or machine paths. The rest of `.claude/` (agents, commands) is already tracked, so `.gitignore` is unchanged. |
| Route check | A scratchpad script ran the ancestry and commit checks below. |
| Build order | A LED-212 line was added under phase 6. |

### Route check output
```
epics-8-13-phase-1 … phase-13 (12 branches): in phase-13 tip=True, in epics-15-19=True
epics-8-13 branches on origin: none
Done tickets in epics 8-13: 47; with a commit in main..epics-15-19: 47
missing in main..epics-15-19: []
missing in main..epics-8-13-phase-13: []
not checked: EPIC-* rows (no own commits), LED-142 and LED-145 (To Do), LED-153 (Won't Do)
LED-128 present, LED-130 present, LED-131 present
commits main..epics-8-13-phase-13: 208
commits main..epics-15-19: 332
```
The script reads the ticket IDs from the `epic-8` to `epic-13` CSVs. It looks for each Done LED-NN in the commit subjects of both ranges, and it asserts the exact list of rows it skips.

## Acceptance
| Criterion | Result |
|---|---|
| (a) The chosen route is written in the retro | PASS. See "Route chosen". |
| (b) `git log main..tip` contains every LED commit, including LED-128, 130 and 131 | PASS. All 47 Done tickets in epics 8 to 13 have a commit in `main..epics-8-13-phase-13` and in `main..epics-15-19`. |
| (c) CI is green on the result | NOT VERIFIED. CI runs only on the PR, and the `epics-15-19` PR is not open yet. |
| (d) `.claude/launch.json` is tracked or added to `.gitignore` | PASS. It is tracked. |

## Validation
- `pnpm lint`, `pnpm build` and `pnpm test`: see the /validate run for this commit.

## What went well
- **The ancestry was already in place.** `epics-15-19` was branched from the phase-13 tip, so the merge route needed no git operations at all.

## What to change
- **The first check counted epic rows as missing commits.** EPIC-* rows never get their own commits. The script now checks only LED-NN rows and asserts the epic rows in its skip list.

## Backlog
- [ ] (c) Confirm CI (`verify` and `db`) is green on the `epics-15-19` → `main` PR, then set LED-212 to Done.
- [ ] After that PR merges, optionally delete the 12 local `epics-8-13-phase-N` branches (owner approval needed). None of them is on `origin`, but every commit in them is already in `epics-15-19`.
- The 3 local commits ahead of `origin/epics-15-19` (plus this one) are not pushed. The owner pushes them when they choose.
