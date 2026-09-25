# Epics 8-13 phase 2 · Documentation reconcile (LED-121, 122, 123) — retro (2026-09-25)

Docs only: no file under `src/` changed. Branch `epics-8-13-phase-2`, one commit per ticket.

## What shipped
- **LED-121 (`07f8d62`):** LED-60 to 65, 70 to 85 and 88 to 99 now read Done, and the EPIC-DENSITY, EPIC-PER-SCREEN and EPIC-DARK-THEME rows read Done. Each flip was gated by a script: a merged `(LED-NN)` commit and a retro whose Acceptance section has no FAIL. Nothing was skipped. Follow-up pointers were appended to LED-24, 40, 41, 60, 61, 64 and 78. `epic-6-build-order.md` says Remaining: 0.
- **LED-122 (`9669e7d`):** corrected the LED-02, 03, 30, 33, 60 and 100 ticket text and `tickets.md` LED-30 and LED-91. The 4c caption and frame label in `Ledger - 2B Screens.dc.html` no longer mention a keypad (2 lines changed, text only). The LED-53, 77 and 93 retros carry a "superseded by LED-115" line.
- **LED-123 (`f3e735e`):** retroactive retros for LED-06 and LED-09.
- `knowledge/patterns/edit-ticket-csvs-without-noise.md`: the round-trip check used for the CSV edits.

## Acceptance
LED-121
- Every ticket with a merged commit and a retro without FAIL reads Done: PASS. The script found 0 skips; epic-5, 6 and 7 read 10, 32 and 2 rows Done.
- Each PARTIAL ticket carries a follow-up pointer: PASS. All seven pointers present (`Follow-up:` in DESCRIPTION).
- Epic rows reflect their children: PASS.
- Build-order header shows the epic complete: PASS (`Remaining: 0 tickets`).
- Every CSV parses, keeps 20 columns, its line ending and no BOM: PASS for all 14 files, and each round-trips byte-identical.
- No application code changed: PASS (`git diff a8e5e11..HEAD --name-only` has nothing under `src/`).

LED-122
- Each listed text is corrected or annotated: PASS by grep (each replacement matched exactly once).
- Design edit is caption text only: PASS. The diff is two changed lines, both caption text.
- Retros annotated, not rewritten: PASS (one added line in each).
- No application code changed: PASS.

LED-123
- Retros exist for LED-06 and LED-09, marked retroactive with commit hashes: PASS.
- Each Acceptance bullet states its evidence: PASS. Line numbers were re-checked, and `tests/thirteenthMonthEncoding.test.mjs` passes 3 of 3.
- The coverage check reports no Done ticket without a retro except LED-01 and LED-66: PASS (the script lists exactly those two).
- No application code changed: PASS.

Checks: `pnpm lint` clean, `pnpm build` succeeds, `pnpm test` 405 of 405 pass.

## Issues found in validate
- While applying, `git add knowledge/retros` staged the untracked planning retro into the LED-122 commit. It was caught in the commit's stat, undone with a soft reset of my own unpushed commit, and recommitted without it. See the pattern above.
- The LED-123 ticket says LED-97 removed the "Records Included" colour. `0fe3e26` did that; LED-97 removed the card. The LED-06 retro records this.

## Backlog
- The Epic 8 to 13 CSVs are untracked, so their statuses were not touched: LED-121, 122 and 123 still read To Do in `epic-11-docs-and-verification-tasks.csv`, and the Phase 1 tickets (LED-104, 129, 132, 133, 135) still read To Do in `epic-8` and `epic-12`. Flip them when those files are committed.
- LED-60 and LED-61 got pointers to LED-125 and LED-124 beyond the ticket's list, because their retros record PARTIAL (2,000 rows not measured in a browser; sticky bar not seen live). Confirm that is wanted.
- The design caption edit was not viewed in a browser. It is text inside a `.dc.html` canvas, but the render was not checked.
- The frame drawn at line 9823 was left as is; the caption now says "same form", which matches what it draws (no keypad grid), but the frame was not compared with the shipped form.
