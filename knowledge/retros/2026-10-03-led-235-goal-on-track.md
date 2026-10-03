# LED-235 · Savings goals show on track or behind by — retro (2026-10-03)

Branch `epics-15-19`. Epic 21, phase A. Decision OD-13 item 3: a straight-line pace from the day the goal was created to its target date.

## What was built
- **`goalStatus({ target, saved, createdAt, deadline, isCompleted, today })`** (`src/lib/goalPace.ts`).
  - **Expected amount.** expected = target × days since creation ÷ days from creation to the date, capped at the target. Saved at or above expected is `on-track`; below it is `behind` by the difference, rounded to cents.
  - **Past or early dates.** Past the date and not reached, it is behind by the remainder. A date on or before the creation day asks for the whole target.
  - **Nothing shown.** No date, complete, or saved ≥ target: null.
  - **Dates.** Days are counted on calendar dates (`Date.UTC` of the local y/m/d), so a DST change can't shift one. `created_at` is read as a local date.
- **`GoalStatusBadge`** (`BudgetsPage.tsx`): "On track" (income outline) or "Behind by $X" (warning outline).
  - On each goal card, it sits after the target month and the months-left badge.
  - In the edit form's "What it takes" panel, it sits with "At or ahead of / Short of a steady pace to {month}".
  - A new goal has no creation date yet, so its form shows no status.
- **Tests** (`goalPace.test.mjs`, +6):
  - the worked example (Jan 1 to Dec 31, Sep 25: 880.22 expected);
  - the null cases;
  - a past date;
  - the creation day;
  - the cap and a date before creation;
  - a timestamp read as a local date.

  The suite also passes under `TZ=Asia/Manila`, `America/Los_Angeles` and `Pacific/Kiritimati`.

## Acceptance
- **(a) The card and detail show the status per the rule: PASS.** Browser at 390 and 1280, on local goals:
  - Japan Trip, created Jan 1, $1,250 of $4,000 by Jun 1 2027: "Behind by $881.78", on the card and in the form (4000 × 275/516 = 2131.78 expected).
  - A goal at $900 of $1,000 by Dec 31: "On track".
- **(b) No target date or complete: nothing: PASS.** Emergency Fund (no date) and a completed goal with a date show no status.
- **(c) A past date not reached reads "Behind by" the remainder: PASS.** $400 of $1,000, due Sep 1: "Past target date" and "Behind by $600.00".
- **(d) A pure `src/lib` function with tests: PASS.**
- **Contrast.** The sweep's scan, run on the Goals tab and the form, light and dark, at 390 and 1280: the new badges pass. No sideways scroll.
- `pnpm lint`, `tsc -b` and `pnpm test` (890 passing, plus `tests/redesign.mjs`) are green.

## Deviations
- **"Detail" is the edit form.** Goals have no detail view. The status sits in the form's "What it takes" panel, the only per-goal detail surface (noted in the plan).

## Found in passing
- **LED-249.** A completed goal card is dimmed with `opacity-75`, which takes its text to 3.73:1 in light and 4.44:1 in dark. Pre-existing. The seed has no completed goal, so no sweep had seen it.
- **The scan reports emoji icons as failures.** They are measured with the CSS text colour. Added to `patterns/rendered-contrast-scan.md`, with the note that a route scan sees only the default tab.

## Backlog
- **LED-249** (above).
- **Seed data.** No completed goal and no backdated goal, so a default `pnpm sweep` can't see either state.
