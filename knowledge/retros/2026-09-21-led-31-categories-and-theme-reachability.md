# LED-31 — Categories and dark mode leave the More sheet

## Pattern
- No source change. LED-30 put Categories in `NAV_TABS` (desktop tabs and the mobile scrolling tab strip) and removed the More sheet; LED-32 put the theme toggle in row 1 at every size. Settings keeps its Light/Dark selector. That met every LED-31 criterion.
- Added a `navDestinations` test pinning Categories as a tab at every size and every bottom-nav tab being in `NAV_TABS`.

## Decisions
- Closed as verify-only rather than adding code. The LED-30 retro line "mobile still uses the account sheet (LED-31/32)" is stale; LED-32 fixed it.

## Backlog
- **No browser check done**: `/categories` reached from the mobile tab strip at 390px, and whether the active tab scrolls into view.
- Row 1 crowding at 390px (from the LED-32 retro) is still unverified.
