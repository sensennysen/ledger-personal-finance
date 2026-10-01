# LED-116 · Pending, liability and loan sites back to gold — retro (2026-09-25)

## What shipped
- `OfflineBanner.tsx`: the pending state (online, not syncing, queued) takes the 22a look: `--warning-container` fill, `--warning` ink, a Clock icon, "Back online — N changes still queued", and a "Sync now" pill filled with `--warning` (text `--warning-container`, 4.62:1 light, 8.11:1 dark). Tones live in one `TONES` map. The flagged and offline branches stay red.
- Upcoming Bills (within 3 days), the credit-card reminder and the Budget Progress amount use `--warning` ink through `WARNING_INK`. They are text, and gold is a fill.
- Budget warning bars use `bg-gold` (the below-threshold band is LED-117). `utilizationTone` mixes income, `--gold`, expense.
- `DashboardPage`: the summary card accent no longer falls back to `GOLD`. The balance card is not a gold meaning, so it is now an explicit `var(--primary)`, which is what it rendered.
- `tests/semanticTokens.test.mjs`: `GOLD` must be `var(--gold)`; five status files may not use `--primary` (the `syncing:` line is allowed); the utilisation tone may not be a text colour.

## Issues found in validate
- **[FIX NOW, fixed]** The live scan measured "30.0% used" on the Credit Card Monitor at 4.08:1 in light. The tone was set as text colour, and its midpoint became `--gold` (`#917738` on `#FAF9FB`). It now uses `text-foreground`, and the bar keeps the tone. Guard added to the test.
- A dashboard bar class was changed from `bg-primary` to `bg-income` in this ticket rather than LED-117, so the guard test could pass at this commit.

## Acceptance
- (a) No listed site uses `--primary` for a status meaning: PASS (guard test).
- (b) Pending banner matches 22a in both themes, failure stays red: PASS live at 1280 and 390. Fill, ink, Clock icon and pill checked; flagged and offline branches unchanged.
- (c) Utilisation gradient runs income to gold to expense: PASS. Live: the tone is `var(--gold)`.
- (d) Guard test: PASS.
- (e) Checked on Home, Budgets and the banner in both themes at 1280 and 390: PASS. Bars, reminders and banner all measured. Dark 0 failures; light failures are listed under Backlog.
- (f) Lint, build, test: PASS (423/423).

## Backlog
- The Syncing banner is a solid `--primary` fill; 22a draws a primary-container tint with the darker indigo ink (`#2E3A63`). It is active state, not pending, so it was left as it is.
- Home "Needs attention" budget alerts ("… is at 85%") render red, not gold. They come from the LED-93 notification surface and were not in scope.
- Pre-existing light-theme contrast failures on untouched code, found by the scan: inactive tab triggers (Weekly / 3 months / 12 months, Ranked, Goals, Analytics, 3.55 to 3.9:1) and recharts axis ticks (3.39:1). About 5 on Home, 1 on Budgets, 17 to 20 on Reports. Dark is clean. Needs its own ticket.
- Not checkable: the Budgets history list bar (`BudgetsPage.tsx`, `hidden sm:block`) had no history rows to show. It shares `budgetTone` with the others, which is unit-tested.
