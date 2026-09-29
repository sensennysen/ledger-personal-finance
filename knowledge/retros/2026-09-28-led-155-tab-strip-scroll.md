# LED-155 · Mobile: first Tab skips the skip link, header tools and tab strip — retro (2026-09-28)

## What shipped
- `TopBar.tsx`'s mobile tab-strip effect no longer calls `Element.scrollIntoView`. It now computes the active tab's offset against the strip's own `scrollLeft`/`clientWidth` and sets `scrollLeft` directly when the tab isn't fully visible. Same `[pathname]` deps, so it still runs on every route change; the desktop tab list (a separate block, no ref) was untouched.
- Added `knowledge/patterns/scrollintoview-moves-focus-start.md`: `scrollIntoView` can move Chrome's sequential-focus starting point regardless of `block`/`inline`, so an effect that keeps something visible on mount should set `scrollLeft`/`scrollTop` directly instead.

## Acceptance
- (a) At 390, load `/`, Tab order Skip to content → Customize dashboard → Search → theme → account menu → tab strip: **PASS, re-run live (2026-09-29).** CDP-driven Chrome headless against local Supabase, real `Tab` key dispatch from a fresh `/` load at 390×844: measured sequence was `Skip to content → Customize dashboard → Search → Switch to light theme → Open account menu → Home (tab strip) → Previous cycle`, matching the AC exactly.
- (b) Active tab still visible at 390 on `/reports`, `/categories`, `/budgets`, `/accounts`: **PASS, re-run live (2026-09-29).** Measured the active `[role="tab"][aria-current="page"]` element's `getBoundingClientRect()` inside the mobile tab strip on each route: `/reports` (left 312, right 390), `/categories` (left 294, right 389), `/budgets` (left 257, right 338), `/accounts` (left 87, right 174) — all fully within the 390px viewport.
- (c) Desktop order unchanged: **PASS.** Desktop's tab list is a separate `<header className="hidden md:flex …">` block with no `ref` — this change touches only the mobile block.
- (d) A pattern note if `scrollIntoView` is a known trap: **PASS.** `knowledge/patterns/scrollintoview-moves-focus-start.md` added.
- Lint, build, full test suite (756 + redesign checks): PASS (re-confirmed 2026-09-29).

## Backlog
- None — (a) and (b) are now confirmed live, closing the gap the original retro flagged.
