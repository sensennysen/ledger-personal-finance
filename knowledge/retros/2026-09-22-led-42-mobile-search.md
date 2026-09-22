# LED-42 — Mobile search is a full-screen view

## Pattern
`SearchPalette` and `SearchBody` are shared between desktop and mobile; only the shell around them differs. `mobile` is a boolean prop threaded from `AppLayout`'s existing `useMediaQuery('(max-width: 767px)')` down through `SearchPalette` → `SearchBody`, so the same query/scope/results state and `resolveLoadState`-backed loading/error handling serve both. `command.tsx` gained a `bare` variant of `CommandInput` (no `InputGroup` box) for the mobile header row, and `CommandDialog`'s `className` is switched to a full-bleed `inset-0 h-dvh` treatment on mobile — no new route, no new dialog primitive.

## Decisions
- Full screen is a `Dialog`/`CommandDialog` styled edge-to-edge, not a router route. It reuses the existing focus trap, scroll lock and Esc handling instead of adding routing complexity.
- "Pushed": a `useEffect` pushes a history entry while the mobile view is open and closes on `popstate`, so the phone's back gesture dismisses it like a native screen. Verified in the browser preview — opening search then invoking a browser back navigation closes the view and lands back on the page underneath, not on the previous route.
- Key-hint footer (↑↓ / ↵ / esc) and `CommandShortcut` (E/I/T) badges are hidden on mobile per design note 7 ("no keyboard hints"). The "Numbers match amounts within ±5%" note is kept since it's information, not a key hint.
- Skipped design details not in the LED-40/41 acceptance line and also absent from desktop: the filter-chip row (All/Transactions/Actions counts), `<mark>` match highlighting, emoji icon tiles, and moving the scope toggle into the group heading.
- `SearchBody` remounts when the viewport crosses the 768px breakpoint while search is open (query resets). Accepted as a rare edge case.

## Acceptance
- Full-screen view pushed from the header search icon: PASS — verified in the browser preview at 375×812 (back arrow, bare input with clear ✕, no key hints, same Record/Jump-to empty state and same grouped results as desktop).
- Back arrow closes the view: PASS — verified by click.
- Phone back gesture closes the view (browser back navigation) rather than leaving the page: PASS — verified.
- Desktop `⌘K` centred palette unchanged (key hints, shortcut badges, boxed input): PASS — verified at 1400×900.
- Same groups/empty-state as desktop: PASS — Record, Due soon (none present in seed data), Jump-to (all 7 destinations) all rendered.

## Backlog
- iOS keyboard interaction and safe-area insets on a real device — only checked via `env()` classes and desktop browser emulation, not a real phone.
- Filter-chip row, `<mark>` highlighting, and emoji tiles from the 16a design frame — intentionally out of scope for this ticket; flag if a follow-up ticket should add them.
- The history-push/back-gesture handling hasn't been tried against react-router's own navigation (e.g. following a "Show all in Activity" link then pressing back).
