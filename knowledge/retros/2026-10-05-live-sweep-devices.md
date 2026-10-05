# LED-178 · Device pass in the iOS Simulator — retro (2026-10-05)

## Method
iOS Simulator (Xcode, iOS 27.0): iPhone 18 Pro (402×874 pt, Dynamic Island), then iPhone 17e (390×844 pt, notch). Mobile Safari is WebKit, so this replaces the 2026-09-29 pass (`2026-09-29-live-sweep-devices.md`), which used static greps and Chrome's iPhone emulation. App: `pnpm dev` on `localhost:5180` against the local Supabase, signed in as the seeded `demo@ledger.local`. No live account touched (AC d).

Checked twice: in a Safari tab, then as an installed web app (Add to Home Screen, "Open as Web App" on). The simulator's on-screen keyboard was used, not a hardware one.

## Results

| Item | Result | Evidence |
|---|---|---|
| iOS decimal keypad on the add sheet (LED-103) | **PASS.** The amount field opens the number pad with a "." key. | `shots/178-sim-keypad-save-hidden.png` |
| Pinned Save on the add sheet (LED-103) | **FAIL → LED-252.** With the keyboard open, "Save Transaction" sits under the keyboard and its accessory bar. Scrolling the sheet moves about 25 pt and stops; Save is reachable only after closing the keyboard. Same in the installed app with the text keyboard. | `shots/178-sim-keypad-save-hidden.png`, `shots/178-pwa-keyboard-save-hidden.png` |
| Keyboard pushing sheets (LED-127) | **FAIL → LED-252** (same cause). The centered entry dialog keeps its `100dvh` height; iOS shrinks only the visual viewport, so the sticky footer stays behind the keyboard. Nothing in `src/` reads `window.visualViewport`. | as above |
| Safe-area insets: shell (LED-30) | **PASS.** Installed app: the header clears the Dynamic Island; the bottom nav labels sit above the home indicator; the add button floats above the nav. | `shots/178-pwa-home-safe-area.png` |
| Safe-area insets: search view (LED-42) | **PASS** (Safari tab). Full screen, the input below the island, nothing clipped. | `shots/178-sim-search-18pro.png` |
| Safe-area insets: sheets | **PASS.** The add chooser's last row clears the home indicator in the installed app. | `shots/178-pwa-add-chooser-sheet.png` |
| PWA install / Add to Home Screen (LED-144) | **PASS.** Share sheet and the Add dialog show the name "Ledger" and a sharp "L." icon; the Home Screen icon is crisp at full size; it launches standalone with no Safari bars. This settles the 2026-09-29 single-icon concern for iOS. | `shots/178-sim-add-to-home-screen.png`, `shots/178-sim-home-screen-icon.png` |
| Cmd+Enter / Cmd+F in desktop Safari (LED-64) | **Not checkable here.** The simulator has no desktop Safari. Needs Safari on the Mac. | — |

### Seen in passing
- **FAIL → LED-253.** The Date field on the add sheet is wider than the other fields and runs past the sheet's right edge, in the tab and in the installed app. Chrome does not show it; WebKit gives `<input type="date">` an intrinsic minimum width. `shots/178-sim-add-sheet-date-overflow.png`.
- The installed app asks to sign in again. iOS gives a Home Screen web app its own storage, so this is expected, not a bug.

## iPhone 17e (smaller screen, notch)
| Item | Result | Evidence |
|---|---|---|
| Decimal keypad | **PASS.** | `shots/178-17e-keypad-save-hidden.png` |
| Pinned Save / keyboard pushing sheets | **FAIL → LED-252.** Save sits under the keypad's accessory bar, as on the 18 Pro. | `shots/178-17e-keypad-save-hidden.png` |
| Date field | **FAIL → LED-253.** Overflows the sheet's right edge, as on the 18 Pro. | `shots/178-17e-add-sheet-date-overflow.png` |
| Safe areas, installed app | **PASS.** The header clears the notch; the bottom nav sits above the home indicator. | `shots/178-17e-pwa-home-safe-area.png` |
| Add to Home Screen | **PASS.** Same name and icon as on the 18 Pro. | — |

In the Safari tab the add button covers the end of "nothing here is permanent." under the setup card (`shots/178-17e-home.png`). This is the floating-button overlap already in the LED-202 backlog, not a new finding.

## Not done
- Real hardware: keyboard animation timing and touch feel are not modelled by the simulator.

## Backlog
- LED-178 stays To Do until the desktop Safari shortcuts (LED-64) are checked on the Mac. Everything else has a result.
- LED-252 and LED-253 were fixed the same day and re-run on both devices (`2026-10-05-led-252-253-ios-keyboard-date.md`).
