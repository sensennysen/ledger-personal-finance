# LED-22 — 13th Month is a route, not a tab

## Pattern
Removing a tab value that users may have persisted (saved report presets store `activeTab`) needs a restore-side fallback. `resolveReportTab` in `src/lib/reportTabs.ts` maps anything that is not a live tab to `'overview'`, so an old preset saved with `'thirteenth'` opens on Overview instead of a blank page.

## Decisions
- `ThirteenthMonthPage` is no longer imported by `ReportsPage`; only `App.tsx` routes to it. `/thirteenth-month` and the More-menu link are untouched.
- Reports links to the route with a plain styled `Link` ("13th Month Pay" + arrow) beside the CSV/PDF buttons. `Button` has no `asChild` and does not export its variants, so a `Link` avoids changing the shared primitive.
- Both duplicated preset-restore call sites use the helper.
- Checks: lint, build and test pass (61 tests, incl. `tests/reportTabs.test.mjs`).

## Backlog
- Manual browser check not run (no browser in the session): link appearance and wrap at small widths, and the page without the old `-mx-4 md:-mx-6` wrapper.
- Restoring an old `'thirteenth'` preset was verified only through the unit test, not in the UI.
- Design 15a shows a "Reports > 13th Month Pay" breadcrumb on the standalone page; not built (outside LED-22 criteria).
- LED-21 removes report presets and `useReportPresets`; `resolveReportTab` and the `activeTab` restore then become dead and should be deleted with it.
- The link sits in the header's right column; the final placement should be re-checked against the LED-21 stepper layout.
