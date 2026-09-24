# LED-99 · Activity detail pane — retro (2026-09-24)

## What shipped
- `AppLayout`: `wide = useMediaQuery('(min-width: 1920px)')`. The existing 340px entry-detail `<aside>` docks only when `wide`. From lg up to 1919, detail opens in a right-side `Sheet` over a list that stays full width. The Esc handler and the `dashboard-detail-pane` hiding follow `wide`.
- `tests/layoutGeometry.test.mjs`: at 1920 the pane, the Activity list (max-w-3xl + md:p-6 = 816px) and the LED-62 month rail (240px) all fit. At 1024 a docked column would squeeze the list. Below 1920 detail is a sheet, never a column.

## Acceptance
- Entry-detail pane has a dedicated home at 1920: PASS in code, backed by the geometry test.
- List stays full width at smaller sizes: PASS in code. Detail overlays instead of taking a column.
- Lint, build and test pass.

## Issues found in validate
- The geometry test first left out the LED-62 month rail. Added it; 1920 still fits (340 + 816 + 240 ≤ 1920).

## Backlog
- Not verified live (Google OAuth sign-in). Unconfirmed: the docked pane at 1920 next to the rail, and the sheet at 1024/1440.
- The 13b design gives the docked pane 380px. It stays at 340px, which is not in the acceptance criteria. 380 still fits (380 + 816 + 240 = 1436).
- LED-62 retro note resolved: at 1920 the rail and the pane sit side by side, and below 1920 the pane overlays the rail.
