# LED-77 · Flatten the credit-card monitor and fix its palette — retro (2026-09-24)

## What shipped
- One card with a divided row per credit card: name, "Spent X of Y" and % on top, then the bar, then one meta line (statement · due · to pay · remaining). The four-deep nesting is gone.
- The reminder strips are one inline line. A due payment uses `GOLD`; a statement reminder uses muted text. There are no raw amber/sky classes left on Home.
- `src/lib/utilizationTone.ts` (tested) grades the colour: `--income` at 0%, `--primary` (gold) at the card's target, `--expense` at 100%, mixed in oklch. `TONED_PROGRESS_CLASS` plus `utilizationToneStyle` drive the `<Progress>` indicator through `--progress-tone`.
- The same tone is on the Accounts and account-detail utilisation bars.
- The monitor no longer spans two columns.

## Acceptance
- Flattened structure: PASS (browser, 1920).
- Tokens only: PASS (grep: no `amber-`/`sky-` in `src/components/dashboard`).
- Gradient, not a binary snap: PASS (tests: 0% and 69% differ; browser: 39.5% on a 30% target renders gold-to-red).

## Backlog
- The light theme wasn't captured. The tone mixes theme variables, so it should follow, but it's unconfirmed.
