# Retro — epic 24 planned from the 2026-10-06 code review

**Context:** `/dev-tasks-planner` turned the 28 findings of `docs/reviews/code-review-2026-10-06.csv` into `docs/dev-tasks/ledger-ui-redesign/epic-24-code-review-findings-tasks.csv` (LED-294 to LED-321, 66 points) and `epic-24-build-order.md` (six phases).

## Decisions

- One ticket per finding, numbered in finding order: LED-(293+n) is REV-00n. Overlapping findings (REV-009/010/025 on queue storage, REV-011/013/014/028 on reads) stay separate tickets linked by DEPENDENCIES, so each stays traceable to the review.
- The build order follows the owner's priority (REV-001, 002, 003, then 004–006) and batches the read/cache work after the write work. Where dependencies required it, the phase order differs from the numbering (LED-301 before LED-300, LED-303 before LED-302).
- The database test suite (LED-319) comes last. Until it lands, each migration ticket records an SQL check in its retro. Moving it to phase 1 was offered as an alternative and not taken.

## Pattern

When the source is a review CSV rather than a design handoff, the 2026-09-18 retro's prerequisite exception applies the same way. The generator read Evidence, Impact, Source locations, Suggested fix and Verification straight from the review CSV instead of retyping them. The validator then checked every row against the review (REV id, every file:line, the fix text, the verification step as criterion (a), and severity as priority), and checked the build order's ids, summaries, points and dependency ordering against the CSV. Reuse that pair of checks for the next review-derived epic.

## Validation

- Structural: no BOM, header identical to epic 23, 20 columns on all 29 rows, STATUS values allowed, every cited source path and line exists, every dependency id exists in a ledger-ui-redesign CSV, every dependency comes earlier in the build order, 28/28 tickets in the build order, points 66 = 66.
- Lint, build and test were not re-run. The change is docs only and no test reads `docs/dev-tasks`. They passed on this same commit (776b69b) during the review.

## Backlog

- Seven owner decisions are open and get settled in each ticket's `/plan`: LED-294, 299, 303, 312, 315, 316, 321.
- 17 findings were carried over on the review's evidence alone; their own `/evaluate` re-checks them. The other 11 were re-confirmed in source.
- The dev-tasks graph (`docs/dev-tasks/ledger-ui-redesign/graphify-out/`, built at 6c5a5076) does not include `epic-24-build-order.md` yet. Re-run `/graphify` on that folder.
- Not committed. The planning docs, `docs/reviews/` and `knowledge/retros/code-review-2026-10-06.md` are untracked and wait on the owner's say for the `epic-24` branch.
