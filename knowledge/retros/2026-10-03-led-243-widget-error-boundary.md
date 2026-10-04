# LED-243 · Each Home widget has its own error boundary — retro (2026-10-03)

Branch `epics-15-19`. Epic 21, phase A. Decision OD-13 item 11. Before this, Home had one boundary: the layout's section boundary around the page.

## What was built
- **`ErrorBoundary variant="card"`** (`src/components/ui/error-boundary.tsx`).
  - **Message.** "This card couldn't load", "The rest of Home still works.", and Retry.
  - **Retry.** Retry clears the error. The failed subtree was already unmounted, so this mounts it afresh.
  - **Logging.** `componentDidCatch` still logs to `console.error`.
  - **Short cards.** Below 140px (the bills strip) the message is one row with no sub-line, so it fits the card's height.
- **`DashboardWidgetBoundary`** (`src/components/dashboard/`).
  - **While healthy.** The wrapper is `display: contents`, so the widget stays the grid item with its own order and span.
  - **Measuring.** A ResizeObserver, re-attached by a MutationObserver when children change, records the visible child's height and computed `grid-column`. The stats widget has a phone and a desktop child.
  - **On error.** The fallback takes the widget's order, that column and that exact height. A widget that never painted gets a minimum of 160px.
- **Wiring.** Every widget in `DashboardPage` is wrapped: bills, stats (both children in one boundary), card monitor, budgets (around its `RefreshingRegion`), recent, chart, pie and forecast.
- **Dev-only forced failure.** `/?throwWidget=<key>` makes that widget throw two seconds after mount, once.
  - **Why through state.** React retries a render that threw, so a throw-once flag would pass on the retry.
  - **Why the flag is set when the timer fires.** StrictMode cleans up the first effect run.
  - **Production.** It is rendered only under `import.meta.env.DEV`, so the production bundle has no trace of it (checked with grep).
- **`tests/widgetBoundary.test.mjs` (10 tests).**
  - Every key in `DEFAULT_WIDGET_ORDER` is wrapped with its own grid style.
  - The forced failure is dev-only.

## Acceptance
- **(a) A widget that throws shows the card message and Retry; the others render: PASS.** All 8 widgets at 390 and 1280 (16 cases): the failed one shows the message, and every other widget renders with no alert. Each failure was logged to the console.
- **(b) Retry remounts it: PASS.** In all 16 cases, Retry rendered the widget again with no alert.
- **(c) The card keeps its size: PASS.** In page coordinates (Home scrolls inside `main`), the fallback's box equals the widget's box before the failure, to within 1px, in all 16 cases. Examples: the bills strip 1232×50 at 1280; Budget Progress 608×265. After Retry, the box is the same again.
- **(d) A browser check with a forced throw: PASS**, plus the source test above.
- **Checks.**
  - `pnpm sweep --routes / --home-fold` (both themes): 5 PASS, and the first four widgets are still above the fold at 390x844 (LED-202).
  - The fallback's own text passes contrast, light and dark.
  - `pnpm lint`, `tsc -b`, `pnpm build` and `pnpm test` are green.

## Deviations
- **Exact height, not a minimum.** The plan said "keeps the measured min-height". A minimum let the fallback grow past short cards (78px became 154px), so it takes the exact height and a compact layout below 140px.
- **The dev trigger fires late.** The first version fired right after first paint, while the cards still showed their loading skeletons, so the fallback took skeleton heights. Two seconds after mount, the measured size is the loaded one.

## Backlog
- **Other pages.** Accounts, Activity, Budgets and Reports still have one section boundary each. OD-13 asked for Home only.
- **No error reporting service.** "Logged" means the browser console.
