# LED-63 · Reports: no pie above 12 categories — retro (2026-09-24)

## What shipped
- `src/lib/categoryBreakdown.ts` (pure):
  - `buildCategoryBreakdown` is the old inline memo, now keyed by category id (names aren't unique). It adds a per-row `share` and a `subcategories[]` split, with any remainder under "No subcategory".
  - `rollupBreakdown` returns pie mode at `PIE_MAX_CATEGORIES` = 12 or fewer. Above that it returns the top `RANKED_TOP` = 8 plus one `other` slice with its own count, amount and share.
  - `previewOther` returns the first `OTHER_PREVIEW` = 6 rows plus the "N more" count and amount.
- `src/components/reports/CategoryBreakdownCard.tsx`:
  - **12 categories or fewer:** a donut plus a legend with amounts and shares.
  - **Above 12:** a Ranked / Grouped / Treemap switch.
    - **Ranked:** 8 bars, then an "Other · N categories" `<button aria-expanded>` in the muted token colour. When opened it shows a grid of 6 rows and a "N more" button that reveals the rest.
    - **Grouped:** subcategory sub-bars under each category.
    - **Treemap:** every category, with labels only on cells over 64×28 and a tooltip for the rest.
  - Every view has the "N categories with activity" subtitle and a "Total expenses" footer.
- `ReportsPage.tsx`:
  - The card is replaced, which drops the old `ScrollArea max-h-56` bar list.
  - The PDF export uses the same rollup and adds an "Other - N categories" row, so its % column adds up to 100 (before, it silently printed only the top 8).

## Decisions made at plan time (approved without change)
- **"Grouped" means category → subcategory.** Neither the spec nor 29a defines it; subcategories are the only hierarchy in the data.
- **Reports gets a donut at 12 categories or fewer.** Reports never had a pie to "retain". The switch appears only above 12, per spec V4: "Add Grouped and Treemap views for the 20–50 case".

## Acceptance
- **Above 12 categories: ranked bars, top 8 shown:** PASS. Unit-tested at 13 and 34 categories (Other count 5 and 26).
- **Remainder in one expandable "Other · N categories" row with its own share:** PASS. Shares of top + Other are tested to sum to 1. The expander is a native button with `aria-expanded` and a `ring-3` focus ring.
- **Grouped and Treemap views added:** PASS. The subcategory split is unit-tested. Both views pass lint and build but were not seen live (see Backlog).
- **Pie retained below 12:** PASS. The 12-category boundary is unit-tested.
- **Lint, build and test:** all pass (162 tests, 7 new).

## Issues found in validate
- **[FIX NOW, fixed]** The view switch used `Tabs` with no `TabsContent`, so assistive tech got tabs that controlled nothing. The card is now the `Tabs` root and the active view renders inside `TabsContent`.
- **Graph check:** `CategoryBreakdownCard` is only reached from `ReportsPage()`. The Dashboard pie (`DashboardCategoryPieCard`) is untouched and has no path to Reports.

## Pattern
- When a segmented switch lives in a card header but controls the card body, make the whole card the `Tabs` root. That keeps the base-ui tab↔panel wiring intact without moving the switch out of the header.

## Backlog
- **Not verified live.** The test account has no transactions (the same call as LED-60/61/62: don't seed it permanently). Unconfirmed in a browser:
  - the bar grid at 390 wide
  - the treemap label contrast
  - dark mode
  - keyboard walk-through of the switch, the Other expander and "N more"
- **Treemap labels use `white` with an `rgba(0,0,0,.35)` outline instead of a token.** Category colours are user-chosen, and no token gives readable text on any colour. A computed contrast pick (light or dark ink per cell) would be better.
- **Uncategorized still falls back to `#888`.** That's carried over from the old memo; it should become a muted token.
- **The treemap is a `role="img"` with a top-5 summary.** Its cells can't be reached by keyboard; the Ranked view is the accessible equivalent.
- **The Dashboard's `DashboardCategoryPieCard` still draws a pie at any category count.** It's outside the LED-63 file list, but the same readability problem applies there.
- **The Other expander's open state isn't reset when the cycle changes.** It's harmless, but it may surprise.
- **The epic-5 CSV status for LED-63 was not edited.**
