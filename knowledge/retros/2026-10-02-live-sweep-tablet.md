# Live sweep · tablet widths 768 to 1023 (LED-206) — retro (2026-10-02)

Tree tested: branch `epics-15-19` at `79a652f` (no source changed). Covers what LED-149 and the lists sweep never saw between 768 and 1023: the result bar, the month-jump bar at exactly 768, the import table, and a filter with two expense currencies (LED-183 is in).

## Method
- Method files: `knowledge/patterns/live-sweep-method.md`, `browser-check-with-local-user.md`.
- Environment: local Supabase, headless Chromium (Playwright), Vite dev server, light theme. Viewport height 1024 at each width (768, 834, 1023), plus 1024 for the rail.
- Users:
  - the demo user (USD, Sep 2026 with 30 rows) for the bar, the jump bar and import;
  - the LED-188 sweep user (default PHP; expenses in PHP, USD and EUR) for the two-currency filter.
- Element rects were read with `getBoundingClientRect`.
- Totals were compared with psql. Each foreign amount was divided by the stored rate (USD 0.01596, EUR 0.01414 per PHP).
- No live account was touched.

## Results
**6 PASS · 2 FAIL · 0 not checkable** (2 notes)

### FAIL (each has a new ticket in `epic-20-phase-4-sweep-findings-tasks.csv`)

| Ticket | Item | Evidence |
|---|---|---|
| LED-226 | The import dialog keeps a side gutter at tablet widths | The dialog fills the viewport edge to edge from 640 to 799px: left/right gutter 0/0 at 640, 700 and 768 (dialog 640, 700, 768 wide), 16/16 at 800, 256/256 at 1280. Below 640 it keeps 16px (343 wide at 375). The base DialogContent sets w-[calc(100vw-2rem)] and sm:w-full; ImportCSVDialog adds max-w-3xl (768px), so between sm and 800px nothing leaves the gutter. Expected: the 16px gutter the dialog keeps on phones. Screenshot: `knowledge/retros/shots/206-import-768.png`. |
| LED-227 | Top categories names a single remaining category "Other, 1 categories" | At 1024 with five categories the list shows four and then "Other, 1 categories ₱1,566.42" (the one left is Transportation). Expected: the fifth category by name, or at least "1 category". src/components/transactions/FilterTopCategories.tsx renders `Other, {other.count} categories` without a singular. Screenshot: `knowledge/retros/shots/206-two-currency-1024.png`. |

### PASS

| Item | Evidence |
|---|---|
| Filter controls between 768 and 1023: which of the bar, the rail and the filter sheet are shown | 768, 834, 1023 (demo user, Sep 2026): search field and the All/Income/Expense/Transfer tabs visible; the phone Filter button hidden; tag chips visible (2 of the seeded tags matched); month rail display:none; month-jump bar shown. Every filter the phone sheet holds is reachable on the page. |
| Result bar at 768, 834 and 1023 | At rest y=327..383, 768px wide (x=0 at 768, 33 at 834, 128 at 1023); "30 transactions match \| of 30 this cycle · Sep 1 – Sep 30 \| Sum +$3,145.02 \| Newest first \| Compact \| Export match"; every button inside the bar (Export match right edge 744 / 777 / 872 against bar right 768 / 801 / 896). Scrolled 900px: pinned at y=120..176 = main top 120 at all three; the next day header (Sep 21) at 215, below the bar bottom 176. |
| Month-jump bar at exactly 768 (and 834, 1023) | Shown below lg with the rail hidden. Mid-list it sits at y=968..1024 (viewport 1024); no add FAB and no bottom nav at these widths. At the end of the list it sits at 944..1000 with the last row ending at 893 (51px clear). "Jump to month" opens a bottom sheet 227px tall listing Oct 2026 −$2,070.00, Sep +$3,145.02, Aug +$1,845.47, Jul +$2,944.47; picking Aug 2026 sets "Aug 1 – Aug 31" and the bar reads "30 transactions match … Sum +$1,845.47", the net the sheet showed. |
| Tablet-width import table (768, 834, 1023) | Six-row problem file into Everyday Checking: the table is 734px inside a 736px wrapper (overflow-x auto, scrollWidth 734), so nothing scrolls sideways; Row, Date, Description, Category and Amount cells all end inside the dialog (Amount 656–751 at 768, 689–784 at 834, 784–879 at 1023). The causes panel shows Unparseable date 1, Amount not a number 1, No category match 3, Matches existing row 1. |
| Two expense currencies in one filter: the result bar sum (768, 834, 1023, 1024) | Sweep user (default PHP), Oct 2026, Expense: "10 transactions match \| of 12 this cycle · Oct 1 – Oct 31 \| Sum −₱9,574.69 · −$65.00 · −€60.00" at all four widths. SQL by currency: PHP 9574.69 (7 rows), USD 65.00 (2), EUR 60.00 (1). The bar sums per currency, as designed; the converted view is Top categories. |
| Two expense currencies in one filter: Top categories shows one combined list in PHP (LED-183 c), at 1024 | Uncategorized ₱4,874.69, Shopping ₱4,243.28, Food & Dining ₱3,706.27, Groceries ₱3,500.00, Other ₱1,566.42. SQL converted at the stored rates (USD 0.01596, EUR 0.01414 per PHP): Shopping 4243.28 (EUR 60), Food & Dining 3706.27 (PHP 1,200 + USD 40), Groceries 3500.00, Transportation 1566.42 (USD 25); the five uncategorised imported rows sum to 4874.69. No currency was left out, so no note. |

### Notes

| Item | Evidence |
|---|---|
| Top categories below 1024 | The list lives in the month rail footer (MonthRail, lg:block), so between 768 and 1023 a filter has no converted view: the bar shows the per-currency sums only. Recorded, not ticketed: the 29a design places the block in the rail. |
| The month-jump bar moves 24px at the end of the list | Mid-list the bar is pinned to the viewport bottom (968..1024); at the end it rests on main's bottom padding (944..1000), 24px up, with page background below it. Not ticketed; LED-149 fixed the larger 88px version of this on phones. |

## Notes
- Every named item has a result at 768, 834 and 1023, and each FAIL has a ticket (LED-226, LED-227 in `epic-20-phase-4-sweep-findings-tasks.csv`). LED-206 is Done.
- LED-226 also explains the LED-205 Backlog line about the import dialog at 768.

## Backlog
- Below 1024 a filter has no converted total. Decide whether the tablet layout needs Top categories (for example, under the result bar) or whether the per-currency sum is enough. This is a design call and is not ticketed.
