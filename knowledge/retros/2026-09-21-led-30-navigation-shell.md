# LED-30 — Two-row top bar replaces the rails

Delivered as four commits (S1 to S4 below), app green after each.

## Pattern
- `src/lib/navDestinations.ts` is the single list of destinations (6 tabs + Settings, bottom-nav subset, `isDestinationActive`). `src/lib/pageChrome.ts` maps a route to `{title, showStepper}`. Both are pure and tested (`tests/navDestinations.test.mjs`, `tests/pageChrome.test.mjs`).
- Row 2 is `PageHeader`; it reads only the route and the cycle, so it never waits on page data. Pages put their buttons into it with `<PageActions>`, a portal into `#page-actions`. Below `md` the header row is hidden, so `PageActions` renders inline and nothing is lost on mobile.

## Decisions
- S1: `TopBar` (row 1), `Sidebar.tsx` deleted, shell is now column-flex (bar, header, body).
- S2: one stepper (`CycleStepper variant="bar"`) in row 2. Removed the Budgets stepper, the two hand-rolled month bars in Activity (desktop and filter sheet) and the Dashboard one. Page `<h1>`s on Accounts, Budgets, Categories, Reports, Settings, Activity are `md:hidden` because row 2 now carries the title.
- S3: below `md`, row 1 is title + status + search + avatar, and the tabs scroll in their own strip (active tab scrolled into view). The stepper is rendered by `PageHeader` on mobile too. Between `md` and `lg` tabs are icon-only and search is an icon.
- S4: `BottomNav` reads `BOTTOM_NAV_TABS`; structure and look unchanged.
- **Deviation from plan:** no `primaryAction` in `pageChrome`. Home, Activity and Budgets each keep their own dialog state, so they portal their buttons through `PageActions` instead of the shell owning the action.
- "Seven destinations" read as six tabs + Settings gear (2B design shows six tabs; 13th Month is a route per D2).

## Backlog
- **No browser check done** (needs Supabase/auth): row 1/row 2 at 1920, 1024, 768, 390; tab-strip scroll; keyboard focus order; shell showing before data loads; Dashboard widget-settings trigger portalling into `#mobile-dashboard-tools` on mobile.
- No design frame for tablet tab overflow; icon-only tabs at `md`–`lg` is my interpretation.
- Search field is a disabled placeholder until LED-40 (no Cmd+K listener).
- Theme toggle exists in row 1 desktop/tablet only; mobile still uses the account sheet (LED-31/32).
- Home keeps its greeting block in content; Dashboard's widget-settings trigger still sits there on desktop.
- FAB and the 176px bottom padding untouched (LED-34); `AppLayout` wrapper divs are not re-indented (kept the diff small).
- Skeleton-free shell (LED-95) holds for the header; the page bodies are unchanged.
