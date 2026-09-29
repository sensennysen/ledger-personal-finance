# LED-178 · Real-device pass — retro (2026-09-29)

## Method note — this was not a real-device pass

LED-178 needs a physical iPhone (Safari + an installed PWA) and this session had neither. Per
the user's explicit call for this ticket (phase 6 planning), every item below got a **best-effort
automated proxy** instead: either a static code check (grep for the relevant attribute/handler)
or a headless-Chrome emulation of the iPhone viewport/UA. Neither substitutes for the real thing —
Chrome's iOS emulation still runs Blink, not WebKit, so it cannot show WebKit-specific bugs (the
real reason this ticket exists). Read every "automated proxy" result below as "the code looks
right," not "verified on device." **LED-178 stays open** — this retro exists so the next pass
starts from code-level confidence rather than zero, not to close the ticket.

## Results

| Item | Method | Result |
|---|---|---|
| iOS decimal keypad on the add sheet (LED-103) | Static: grepped the amount field | **Automated proxy — looks right.** `src/components/transactions/TransactionForm.tsx:402` sets `inputMode="decimal"` on the amount input, which is what asks iOS Safari for the decimal keypad. Not checkable further without an iPhone (the keypad itself is OS-rendered, invisible to Chrome). |
| Pinned Save on the add sheet (LED-103) | Not checkable | No code signal to check statically (this is a WebKit viewport/position:sticky behavior under the on-screen keyboard); marking **not checkable — no iPhone**. |
| Safe-area insets on the shell, search view and sheets (LED-30, LED-42) | Static: grepped `env(safe-area-inset-*)` | **Automated proxy — looks right.** Present on the shell (`AppLayout.tsx:258,315,367,397`), the bottom nav, the FAB, the search palette (`SearchPalette.tsx:97`), and every bottom sheet checked (`MonthJump.tsx`, `TransactionKindMenu.tsx`, `notification.tsx`, `PWAInstallBanner.tsx`, `BottomNav.tsx`). `index.html:10` sets `viewport-fit=cover`, which is required for `env()` to resolve to anything but 0. Cannot confirm the actual notch/home-indicator geometry without a device — Chrome's device emulation reports 0 for all safe-area insets on every platform. |
| Keyboard pushing sheets (LED-127) | Not checkable | Chrome DevTools has no soft-keyboard viewport-resize emulation, and this is specifically about how iOS Safari resizes the visual viewport under the keyboard. **Not checkable — no iPhone.** |
| Cmd+Enter / Cmd+F in desktop Safari (LED-64) | Static: grepped `metaKey` handlers | **Automated proxy — looks right.** `SearchPalette.tsx:233` (`mod && event.key === 'Enter'`) and `:239` (`mod && event.key.toLowerCase() === 'f'`), both gated on `event.metaKey \|\| event.ctrlKey`. Cannot confirm Safari doesn't intercept either combination for its own UI before the page sees them — that's a real-Safari-only question. |
| PWA install / Add to Home Screen (LED-144) | Static + headless build check | **Automated proxy — partial concern.** `public/manifest.json` has `display: standalone`, `start_url: /`, `scope: /`, `theme_color`/`background_color` set, and a service worker (`pnpm build` confirms `vite-plugin-pwa` emits `dist/sw.js`). But the manifest has exactly one icon, 377×377, declared `"sizes": "any"` — Chrome's installability check wants an explicit ≥192px and ideally a ≥512px entry with numeric `sizes`; `"any"` is valid per spec but is the less-supported form and iOS's Add-to-Home-Screen reads the manifest differently from Chrome's installability heuristic again. **Flag, not a FAIL**: worth a real device or Lighthouse PWA audit to confirm installability before trusting this. |

## FAILs

None raised — nothing above reached a clear FAIL; two items are open concerns (Save button pinning
behavior, and the single-icon manifest) that need the real device to resolve either way.

## Backlog

- Re-run this whole ticket for real on an iPhone (Safari + an actual Add to Home Screen) once one
  is available. Everything above is "the code looks plausible," not a pass.
- Run a Lighthouse PWA audit (or `pnpm dlx pwa-asset-generator`) to check whether the single
  377×377 `sizes: "any"` icon is enough for both Chrome's installability heuristic and iOS's
  Add-to-Home-Screen icon rendering, or whether it needs an explicit 192/512 pair.
