# LED-21 — Reports follows the global cycle; presets removed

## Pattern
`getReportRange` (`src/lib/reportCycle.ts`) is pure and turns the global `selectedMonth` + `startDay` into `{start, end, label, filenameLabel}`, unit-tested in `tests/reportCycle.test.mjs`. `ReportsPage` reads `useCycle()` (not `useMonthCycle` directly, as Dashboard does) and feeds the range into the existing `filtered` memo, so stat cards, table, category and merchant breakdowns, CSV and PDF all follow the stepper.

## Decisions
- Removed the seven presets, custom range, saved presets, both control trees (desktop and mobile), both dialogs, the GOLD preset chips and `useReportPresets`. Saved presets lived in localStorage only, so they are orphaned, not migrated.
- `/reports` was added to the routes that show `CycleStepper` in `AppLayout`.
- Trend charts (`monthlyData`, `netWorthData`) already ignored `filtered`; they are now labelled "Last 12 months · monthly" / "Last 13 months · monthly". No selector: that is LED-21a.
- **Scope extension:** `OverspendingCard` had its own local stepper, which LED-23's retro said to swap under LED-21. Two steppers on one page would defeat the ticket, so it now takes `month` from the page and only shows the range caption.
- `resolveReportTab` is now unused by the app (it only served saved presets). Left in place with its test; delete it in a cleanup.

## Backlog
- Manual browser check not run: stepping cycles on `/reports`, trend charts unchanged, CSV/PDF filename and range label.
- LED-30 (full two-row shell) is not done; the existing `CycleStepper` in `AppLayout` was reused.
- "All time" and custom ranges are gone by design (D3); whole-history export has no replacement.
- Desktop/mobile duplication of remaining controls is LED-70; page width cap is LED-33.
- The current cycle range runs to the cycle end, so future-dated transactions in it are counted.
- PDF header now shows the cycle label instead of a preset name; not visually checked.
