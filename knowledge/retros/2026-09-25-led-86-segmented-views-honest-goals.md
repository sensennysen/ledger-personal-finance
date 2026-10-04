# LED-86 · Segmented views and honest goals — retro (2026-09-25)

## What shipped (`93ff234`)
- Budgets | Goals is a two-part toggle stored in `?view=goals`. `resolveHeaderMeta(pathname, search)` hides the cycle stepper on the Goals view; every other route ignores `search`.
- Budget history is no longer a tab. It is a section under the budget list, shown once budgets are on screen, so the list above owns the error and loading states.
- The budgets stale-error banner moved inside the Budgets view so it no longer shows on Goals.
- `budgetUsage(spent, effective)` in `src/lib/budgetUsage.ts` (5 tests): the bar fill is held at 100% and the row shows the real rounded percentage. A zero limit with spending reads "Over".
- The budget form names its cycle: "Runs Sep 1 – Sep 30". When the start day isn't 1 it adds ", following your pay cycle — not the calendar month".
- `goalPace` in `src/lib/goalPace.ts` (5 tests) counts calendar months to the target date (at least 1). It replaces the card's `diffDays / 30`.
- GoalForm: "Current Savings" is renamed "Saved so far", "Deadline" is renamed "Target date". A live "What it takes" panel and the 23a manual-tracking note were added.
- Goal card: "$240.00/mo to hit Jun 2027", a "Past target date" badge, and "Shown for reference — they don't change Saved so far" under linked transactions.
- Fixed the "Warning" badge. It compared the percentage against `BUDGET_WARNING_THRESHOLD * 100` (8000) and could never show. The threshold is already 80.

## Acceptance
- Budgets and Goals in separate views: PASS. The stepper is hidden on Goals and shown on Budgets at 390, 768 and 1920 (unit test and browser).
- Over-budget rows cap the bar and carry the true percentage: PASS. Browser: Dining 109%, Transport 106%, both bars full.
- Cycle dates shown in the form: PASS. "Runs Sep 1 – Sep 30." and, with start day 15, "Runs Sep 15 – Oct 14, following your pay cycle — not the calendar month."
- Monthly contribution derived from target + saved + date: PASS. The design's example ($4,000, $1,840 saved, Jun 30 2027, today Sep 25 2026) gives $240/mo over 9 months, in the unit tests and in the browser.
- Goals say they are manual: PASS. A note at the top of the Goals view, the note in the form, and the note on linked transactions.

## Decisions
- The "manual" copy doesn't say goals have no links. Transactions can carry `goal_id` and the card totals them, but `current_amount` only changes through edits and contributions. The copy says exactly that.
- The view is in the URL, not in component state, because the header chooses the stepper from the location.

## Backlog
- From 4b, not built: the summary tiles (Budgeted, Spent, Remaining, Over budget), "Copy last cycle", "Needs attention", the table layout sorted by % used, and goal "on track / behind by". The last one needs a contribution history.
- The mobile page still shows both the shell title "Budgets" and the page's own "Budgets & Goals" h1. This was already the case before this change.
- `Progress` renders a hidden "x" label that shows in `innerText`. Not visible and not new.
