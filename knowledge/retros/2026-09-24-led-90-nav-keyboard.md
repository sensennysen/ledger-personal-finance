# LED-90 · aria-current, roving tabIndex, skip link — retro (2026-09-24)

## What shipped (`d50b253`)
- Both TopBar tab rows (desktop, and the mobile "Sections" strip) are a `role="tablist"` of `role="tab"` NavLinks with `aria-selected` and `aria-current="page"`.
- Roving tabIndex from `rovingTabStop` in `src/lib/navDestinations.ts`: the active tab is `0`, the rest `-1`. With no tab active (Settings, 13th Month) the first tab holds the stop.
- `nextTabIndex`: ←/→ wrap, Home/End jump. Arrows move focus only, and Enter follows the link. Locked tabs stay in the cycle.
- The mobile strip scrolls the focused tab into view.
- BottomNav sets `aria-current` from `isDestinationActive`, like TopBar, instead of NavLink's own `end` matching.
- "Skip to content" is the first element in the shell. It is `sr-only` until focused, and focuses `<main id="main" tabIndex={-1}>` by hand, so the URL never gets `#main`.
- The FAB precedes BottomNav in the DOM (27a).
- Settings stays outside the tab group, as in the 27a frame.

## Acceptance
- aria-current on the active destination: PASS. Browser: TopBar desktop and mobile, BottomNav at 390. None is set on /settings.
- Tabs are one tab stop, active 0 and others -1, arrows move: PASS.
  - Browser at 1920: → from Home goes to Accounts. End goes to Reports. → wraps to Home and ← wraps to Reports. Tab leaves to Search.
  - Browser at 390: 5×→ reaches Reports and it is scrolled into view.
  - Unit tests: 6 new cases in `tests/navDestinations.test.mjs`.
- One skip link, visible on focus: PASS. Browser at 1920: it is the first stop and shows at the top left, 126×40. Enter moves focus to `main#main` and leaves no hash, and the next Tab goes to the first control in the content.

## Decisions
- Kept `role="tablist"`/`tab` as the ticket and design specify, although these are route links, not tabpanels. The alternative was a plain `<nav>` of links with roving tabIndex. It wasn't chosen.
- Tab order at 1920 is skip → logo → tab group → Search → theme → Settings → avatar → cycle stepper → Add Transaction → content.

## Backlog
- **The logo link is an extra stop** before the tab group. The 27a frame doesn't number it. Decide whether it should be `tabIndex={-1}`, since Home is the next stop anyway.
- **Mobile: Tab from `<body>` skipped to row 2** in headless Chrome with mobile emulation. From the skip link, the order is correct in both directions (skip → Customize → Search → theme → avatar → strip → row 2). Check on a real phone with a keyboard.
- The FAB is correctly before BottomNav, but it had `tabIndex=-1` in the test because the short test page sat at its scroll end, so it was not seen in the Tab order.
- Tab links have no `focus-visible` ring of their own; they rely on the browser outline. Not seen live.
