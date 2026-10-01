# Epics 8-13 phase 11 · Accessibility, density, skeletons, theme — retro (2026-09-26)

Branch `epics-8-13-phase-11`: LED-148, 149, 150, 151 (20 points), one commit each, plus one live-check fix each for LED-149 and LED-150. Lint, build and all 666 tests pass (630 before this phase's last ticket, 617 before the phase).

## Ticket retros
[LED-148](2026-09-26-led-148-accessibility-leftovers.md) · [LED-149](2026-09-26-led-149-density-leftovers.md) · [LED-150](2026-09-26-led-150-skeletons.md) · [LED-151](2026-09-26-led-151-theme-leftovers.md)

## Decisions worth keeping
- The logo link leaves the tab order; the AlertDialog keeps base-ui's default focus; the auth bootstrap keeps its spinner. All three recorded, none confirmed with design.
- `theme` stays light or dark for every consumer; only Settings and the provider know about `system`.
- Pure logic is split from what Node cannot load: `accentTokens` takes Material's tones as input, `netSign` sits beside `formatNet` (which imports `@/lib/utils`).
- `signedAmount` is the one sign rule. The row, day header, month net and result-bar sum all come from it, in the currency of the account the money lands in.

## Live checks
Local Supabase test user (created twice, removed both times), headless Chrome over CDP at 1280x900, 1280x1000 and 390x844, both themes, requests held with `Fetch.requestPaused` to see skeletons. The live checks found three bugs the suite did not: Home's breakdown capped at 8 (so the ranked view could not appear), the month-jump bar floating 88px above the nav, and Categories' skeleton sitting 8px off.

## Patterns added
`sticky-offset-is-inside-scroller-padding.md`, `do-not-cap-data-before-a-ranking-view.md`; `loading-states.md` and `browser-check-with-local-user.md` extended.

## Backlog (not verified or deferred)
- No screen reader was run: the live regions and the cmdk "N more" path need VoiceOver or NVDA (LED-148).
- LED-149 item 9 (virtualisation) waits for LED-125; nothing is measured.
- Home's first-run checklist shifts the page 362px when it arrives; the net worth note and the forecast's recurring items are data-dependent (LED-150).
- Not measured: the loan purchase tracker, the Categories subcategory, rules and Unused skeletons, the Liabilities column with a loan.
- A failed 13th Month year read was not exercised, and the refresh is pointer-blocked only.
- Not run on a real iOS device, at a tablet width, or with two expense currencies in one filter.
- One dark frame on load for a System user on a light OS (no pre-paint script under the CSP).
- The rendered contrast scan was not run on Settings or the ranked Home card.
- The epic CSVs and `.claude/launch.json` are still untracked; ticket statuses were not flipped.
