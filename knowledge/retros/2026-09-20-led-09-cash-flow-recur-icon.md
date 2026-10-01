# LED-09 · Cash-flow forecast renders the word 'Recur' — retro (written retroactively 2026-09-25)

Written on 2026-09-25 from the code and `git log`, not from the original session. LED-09 shipped on 2026-09-20 without a retro. Commit `9d54073`. Checks below were re-run today, not recorded at the time.

## What shipped (`9d54073`)
- `src/components/dashboard/DashboardCashFlowForecastCard.tsx`: an uncategorised recurring item rendered `item.tx.category?.icon ?? 'Recur'`, which put the literal word in an icon-sized slot. It now renders a muted lucide `Repeat` glyph.
- The icon sits in a fixed-width slot (`w-4 flex justify-center shrink-0`) so rows stay aligned with rows that show an emoji.

## Acceptance
- A real fallback icon: PASS by code. The fallback is at `DashboardCashFlowForecastCard.tsx:92` (`<Repeat className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />`). The glyph is `aria-hidden`; no text label was added.
- The word "Recur" is gone: PASS. A grep of `src` finds no `'Recur'` literal (only unrelated `recurrence`/`Recurring` names).

## Issues found in validate
- None recorded at the time. The lint, build and test results of the original session were not written down.

## Backlog
- Not verified live: no browser check of a forecast with an uncategorised recurring item was recorded, and there is no test for this card.
- Alignment of the fixed-width slot against emoji rows was not checked in a browser.
