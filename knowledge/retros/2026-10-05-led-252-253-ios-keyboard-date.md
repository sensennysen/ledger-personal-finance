# LED-252 · LED-253 — iOS keyboard covers Save; date field overflows — retro (2026-10-05)

Branch `fix/led-252-253-ios-keyboard-date`. Both found by the LED-178 simulator pass (`2026-10-05-live-sweep-devices.md`).

## What was done
| Ticket | Change |
|---|---|
| LED-253 | `src/index.css` base layer: `appearance: none` on date, time, month and datetime-local inputs, and left-aligned `::-webkit-date-and-time-value`. WebKit's native date box has its own minimum width and ignored `w-full`. One rule covers every `type="date"` input (TransactionForm, TransactionRecurringFields, LoanPurchaseForm, BudgetsPage). |
| LED-252 | `src/lib/visualViewport.ts` (pure, tested): turns a visual-viewport sample into `--vv-height`, `--vv-center`, `--vv-bottom`, or null when there is no keyboard or the page is pinch-zoomed. `src/hooks/useVisualViewportVars.ts`, mounted once in `App`, mirrors them onto `<html>` and removes them when the keyboard closes. `DialogContent` centres on `--vv-center` (fallback `50%`) and caps at `--vv-height` (fallback `100dvh`); the ten `max-h-[calc(100dvh-0.75rem)]` dialogs and the account sheet use the same fallback form; `.m3-bottom-sheet` sits on `--vv-bottom`. The hook also centres the focused field in its dialog on resize and on `focusin`. |

With no keyboard the variables are unset, so every rule resolves to exactly what it was before.

## Verification
- `pnpm lint`, `pnpm build`, `pnpm test` (1012 pass, includes 6 new in `tests/visualViewport.test.mjs`).
- iOS Simulator, iOS 27.0:

| Check | iPhone 17e, Safari | iPhone 18 Pro, installed app |
|---|---|---|
| Keypad open on Amount: Save and Cancel visible above it | PASS (`shots/252-17e-keypad-save-visible.png`) | PASS (`shots/252-pwa-18pro-keypad-save-visible.png`) |
| Focused field visible above the sticky footer | PASS | PASS |
| Whole form scrolls to its end with the keypad open | PASS (`shots/252-17e-form-scrolls-with-keypad.png`) | — |
| Text keyboard on Description | PASS (`shots/252-17e-text-keyboard-save-visible.png`) | — |
| Closing the keyboard restores the sheet without a jump | PASS | PASS |
| Date field as wide as Description, inside the sheet | PASS (`shots/252-17e-date-fixed.png`) | PASS (`shots/252-pwa-18pro-date-fixed.png`) |
| Account bottom sheet, no keyboard | — | PASS, still at the bottom |

- Desktop Chrome (browser pane, 1024×768): variables unset, dialog `top: 384px` (50%), `max-height` unchanged at `90vh`; the Date field keeps its calendar icon in the two-column layout.

## How it went
- `scrollIntoView({ block: 'center' })` did nothing inside the fixed dialog on iOS. An on-screen readout showed one `resize`, the variables set, and `scrollTop` still 0. Setting `scrollTop` from the two bounding rects works.
- Without the readout's forced layout, a two-frame wait sometimes ran before the keyboard settled. A second pass at 350 ms fixed it; centring is idempotent.

## Backlog
- The keyboard's down arrow does not move from Amount to the next field (Currency is a button-style select). iOS behaviour, not changed.
- The Amount field is prefilled with `0`, so typing `12.50` shows `012.50` (it still parses as 12.5). Pre-existing; a ticket if it bothers anyone.
- Desktop Safari and Android Chrome were not run. Android resizes the layout viewport for the keyboard, so the variables should stay unset there; not observed.
- Sheets other than `DialogContent` and `.m3-bottom-sheet` (the `Sheet` side/bottom primitive, e.g. Entry detail, MonthJump, the Activity filter sheet) do not read `--vv-*`. None of them was seen with a text field under the keyboard.
