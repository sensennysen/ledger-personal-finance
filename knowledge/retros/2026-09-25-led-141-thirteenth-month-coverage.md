# LED-141 · 13th Month 15a: coverage strip and PD 851 checklist — retro (2026-09-25)

## What shipped
- `thirteenthMonth.ts` (pure): `monthCoverage` (covered, partial, missing, future; a past year has no future months and a later year is all future) and `pd851Checklist` (four rows; each counts the ticked records that look like the row, by category name).
- `CoverageStrip`: 12 bars in an `<ol>`. Height and outline carry the status as well as colour (covered tall and solid, partial short in gold, missing a stub, future a dashed outline), each bar has sr-only text ("August: 2 of 3 records counted"), and a legend names the four states. No opacity.
- `Pd851Checklist` replaces the blue info paragraph: tick and cross rows with sr-only "Counts:" / "Does not count:", and a line under a cross row when ticked records look excluded. The "saved on this device only" sentence is kept.

## Decisions
- Salary matching stays a category-name regex. The excluded-kind patterns are name-based too, so a renamed category is missed (a per-user flag is Parked).
- A month with no income at all, once it has started, is "missing"; the current month included.
- The old paragraph's instruction ("check only the records that qualify") went; the page subtitle keeps it.

## Acceptance
- (a) A 12-bar strip with a text alternative per bar: PASS live (all twelve sr-only strings read back, including "no income recorded", "2 of 3 records counted", "not yet").
- (b) PD 851 rules as a four-row list driven by the records: PASS live ("8 selected records" on the basic row after Auto-select salary only). The cross-row warning is unit-tested only.
- (c) Coverage unit tests, a full year, a partial month, a gap, a future month: PASS (plus a past and a later year).
- (d) 1920, 1280, 390, both themes: PARTIAL. Contrast scans were clean on this page at 1920 in both themes and at 375 in light. It was viewed at 1024 and 375 in dark; 1280 was not checked on its own, and the partial (gold) bar was not screenshotted.
- (e) Lint, build, test: PASS (589/589).

## Backlog
- Screenshot the partial bar and the missing stub, and the cross-row warning with a ticked bonus.
- The strip's bars are equal-height for covered and future; if 15a intends height to mean amount, that is a redraw.
