# LED-117 · Budget bars: gold warning, income below the threshold — retro (2026-09-25)

## Design answer (criterion a)
Design 4b and 18a fill every budget bar under 100% indigo (`#55659A`; 84%, 71%, 49%, 36%) and over-budget bars red (`#B4574A`). No gold meter appears in either frame; gold in 4b is the "Over budget" card border and the Needs-attention callouts. The ticket asks for income, then gold, then destructive. **The ticket was followed, and the frames were not.** The ticket's own text, the LED-93 wording ("budgets use GOLD and INCOME tokens") and its user story all ask for a colour change at the warning line, and the frames give the warning line none. If design intends indigo, change `budgetTone` and `BUDGET_TONE_BAR_CLASS` only.

## What shipped
- `lib/budgetUsage.ts`: `budgetTone(pct, over)` returns `income` (up to 80), `gold` (above 80, up to 100) or `expense` (over). `BUDGET_TONE_BAR_CLASS` holds the literal class strings. `BUDGET_WARNING_THRESHOLD` moved here from `constants/accounts.ts`, because that file imports lucide-react and cannot be loaded by `node --test`.
- Call sites: Budgets list bar, Budgets main card, Dashboard Budget Progress. The Warning badge on Budgets now reads `budgetTone === 'gold'`. It was `>= 80` while the bars used `> 80`, so it showed at exactly 80% with a green bar.
- `tests/budgetUsage.test.mjs`: tone at 0, 80, 81, 100 (not over), 101 and over.

## Acceptance
- (a) Bands checked against 4b and 18a and recorded: PASS (above), with the deviation.
- (b) One helper drives three sites: PASS.
- (c) Income below the threshold, gold above, destructive over: PASS. Live: green at 30%, gold at 85%, red at 130%, both themes and widths.
- (d) Unit tests at 0, threshold, threshold + 1, 100, over 100: PASS.
- (e) Lint, build, test: PASS.

## Backlog
- Confirm with design whether the frames' indigo is intended (see above).
- The Budgets list bar is `hidden sm:block` and the live account had no history rows, so only the unit tests cover it.
