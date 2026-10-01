# Epics 8-13 phase 9 · Design parity: Activity, Search, Budgets, Reports, Categories — retro (2026-09-25)

Branch `epics-8-13-phase-9`: LED-137, 139, 140, 141, 152 (31 points), one commit each, plus one search fix found in the live check. Lint, build and all 589 tests pass. Test count went from 548 to 589.

## Ticket retros
[LED-137](2026-09-25-led-137-search-palette-parity.md) · [LED-139](2026-09-25-led-139-budgets-4b.md) · [LED-140](2026-09-25-led-140-reports-parity.md) · [LED-141](2026-09-25-led-141-thirteenth-month-coverage.md) · [LED-152](2026-09-25-led-152-categories-desktop.md)

## Decisions worth keeping
- Budgets are one recurring row per budget, so "Copy last cycle" became "Add from last cycle" (`rules/budget-is-one-recurring-row.md`).
- Reports keeps Net Worth and adds Over budget as a fifth card; the "Overspending history" link is omitted.
- Needs attention reuses `--warning-container`; no new gold tint token.
- Reports' CSV is a sibling of the full export, so the deletion export (LED-89) and LED-143 are untouched.
- Width caps: Categories widens from xl; Activity, Account detail, Budgets and Settings keep theirs (table in the LED-152 retro).

## Live checks
Local Supabase test user, the built-in browser at 1920, 1440, 1024, 768 and 375. Budgets, Reports, 13th Month and Categories were checked at several sizes; the search palette at 1920, 768 and 375. Rendered contrast scans (`patterns/rendered-contrast-scan.md`) ran on the four pages at 1920 in both themes and at 375 in light. Dark was clean. Light showed only the inactive tab labels (3.55:1) and a disabled button (exempt). No page scrolled horizontally at 375.

## Backlog (not verified or deferred)
- Light-theme look of the search palette; pressing the phone account toggle.
- The failure path of "Add from last cycle"; a generated PDF's contents; the breadcrumb link click.
- Screenshots of the 13th Month partial and missing bars, and of Categories at 1920 in both themes; Account detail and Settings at 1920.
- Inactive tab labels fail 4.5:1 in light (shared `TabsTrigger`); needs its own ticket (already noted in LED-116).
- Each Budgets load sends a 400 request (`__no_budget_selected__`). Spin-off offered.
- Not built: 16a's budget-used line on search category rows, 8a's filter box, phone category screen and Merge, 4b's goal lines.
- The `.claude/launch.json` and the epic CSVs are still untracked; ticket statuses were not flipped.
- The all-history Categories usage read may need an RPC if it proves slow.
