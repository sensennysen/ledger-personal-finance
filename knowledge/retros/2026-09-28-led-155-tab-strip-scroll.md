# LED-155 · Mobile: first Tab skips the skip link, header tools and tab strip — retro (2026-09-28)

## What shipped
- `TopBar.tsx`'s mobile tab-strip effect no longer calls `Element.scrollIntoView`. It now computes the active tab's offset against the strip's own `scrollLeft`/`clientWidth` and sets `scrollLeft` directly when the tab isn't fully visible. Same `[pathname]` deps, so it still runs on every route change; the desktop tab list (a separate block, no ref) was untouched.
- Added `knowledge/patterns/scrollintoview-moves-focus-start.md`: `scrollIntoView` can move Chrome's sequential-focus starting point regardless of `block`/`inline`, so an effect that keeps something visible on mount should set `scrollLeft`/`scrollTop` directly instead.

## Acceptance
- (a) At 390, load `/`, Tab order Skip to content → Customize dashboard → Search → theme → account menu → tab strip: **PASS by code, not re-run live.** The reported mechanism (`scrollIntoView` on the tab strip moving Chrome's Tab-start point) is gone — nothing in the new effect calls `scrollIntoView` or any other API known to have that effect. No browser extension was connected this session to re-run the CDP bisect from `browser-check-with-local-user.md` point 11.
- (b) Active tab still visible at 390 on `/reports`, `/categories`, `/budgets`, `/accounts`: **PASS by code.** The effect still runs on every `pathname` change and scrolls the active tab into the visible range; not re-verified pixel-for-pixel live.
- (c) Desktop order unchanged: **PASS.** Desktop's tab list is a separate `<header className="hidden md:flex …">` block with no `ref` — this change touches only the mobile block.
- (d) A pattern note if `scrollIntoView` is a known trap: **PASS.** `knowledge/patterns/scrollintoview-moves-focus-start.md` added.
- Lint, build, full test suite (756 + redesign checks): PASS.

## Backlog
- Re-run the LED-124 CDP bisect (stub `scrollIntoView`, then don't, and diff the Tab sequence) once a browser extension/session is available, to confirm (a) and (b) live rather than by code inspection alone.
