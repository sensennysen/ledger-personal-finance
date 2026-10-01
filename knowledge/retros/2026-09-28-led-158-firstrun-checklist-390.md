# LED-158 · First-run checklist step 2 is crushed at 390 — retro (2026-09-28)

## What shipped
- Only the transaction step's button group (`Import` + `Add entry`) changed: `w-full basis-full sm:w-auto sm:basis-auto` added alongside its existing `shrink-0`/`gap-2`. Inside the row's existing `flex flex-wrap` container, a full-width flex item is forced onto its own line below `sm` (640px) instead of competing with the text column for space on one line — which is what let the text column get crushed to a few characters wide before wrapping. At `sm`+ the group returns to `w-auto`/`basis-auto`, identical to today.
- Steps 1 ("Add account") and 3 ("Set your pay cycle") have a single button each and were not touched — they weren't reported broken and this keeps the diff to the one row that was.
- **Follow-up (2026-09-29):** a live re-check (below) found the row still 31px over its height target. Two more scoped changes closed the gap: the row's shared `gap-4` became `gap-x-4 gap-y-2` (only changes anything where content wraps to a second line, which today is only this step below `sm`); the description gets `line-clamp-1 sm:line-clamp-none`, scoped to `step.id === 'transaction' && !step.done` so steps 1/3 and the `sm:`+ layout are untouched.

## Acceptance
- (a) At 390 step 2 is no taller than about 130px, title wraps at most twice: **PASS, re-run live (2026-09-29) after the follow-up fix.** First re-check (before the follow-up) measured row height 161px — 31px / ~24% over "about 130px" — root-caused to the description line wrapping to 2 lines inside the same flex item that sets the row's height. After the gap-y and description-clamp fix, re-measured on a fresh seeded user (account, no transactions) at 390×844: **row height 134px** (4px over "about 130px", down from 31px over), title still wraps to exactly 2 lines, description now clamps to 1 line with an ellipsis below `sm`.
- (b) Buttons fully visible, not covered by the FAB at scroll top: **PASS, re-run live (2026-09-29).** Both "Import" and "Add entry" render on their own line (`top` 417, `bottom` 445) inside the now-134px row; screenshot confirms the FAB sits well below, not overlapping.
- (c) 1280 unchanged: **PASS, re-run live (2026-09-29).** Row height at 1280×900 measured 80px both before and after the follow-up fix — `sm:line-clamp-none` and `gap-y-2` (irrelevant when nothing wraps) mean the desktop layout is byte-for-byte unaffected.
- Lint, build, full test suite (756 + redesign checks): PASS (re-confirmed after the follow-up fix).

## Backlog
- None. The original ~24%-over height gap is closed to ~3% over "about 130px," verified live with screenshots at both breakpoints.
