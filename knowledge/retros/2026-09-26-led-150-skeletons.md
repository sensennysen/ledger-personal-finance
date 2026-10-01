# LED-150 · Skeletons for the remaining sites (25a) — retro (2026-09-26)

## What shipped (`addf57b`, fix `cea253d`)
- **`SkeletonText`** (`ui/skeleton.tsx`): an inline-block `0.75em` grey run that goes inside a parent with the real font size, so the line keeps its real height. `Skeleton` is `motion-reduce:animate-none`.
- **Home.** A `DashboardTransactionRowSkeleton` twin (same grid, real icon tile, grey runs) for Recent Transactions; the pie card loads as a donut plus five legend rows; Upcoming Bills, the Forecast (real labels, grey values) and the stat tiles (value line at its real `1.75rem`, plus the sub-line when there is one). The cash flow chart keeps its block, now with its own radius.
- **Accounts.** The real summary band (labels stay) and both column headings over real-shaped rows. **Categories:** the real tab strip (disabled, counts `…`), column header, row shells, the empty pane, and skeletons for the subcategory, rules and Unused sites. **Loan purchases:** the real card shell. **13th Month:** the hero (its two lines), the coverage strip (real month letters and legend), and a month header plus rows.
- **13th Month keeps the previous year.** The hook does not tag its rows, so the page reads the year from the rows' dates (`dataYear`). While a different year is loading it keeps the old rows, titled with their own year and totalled with that year's saved selection, inside a `RefreshingRegion` ("Loading 2025…"). If the new read fails the old rows are dropped and the error shows.
- **Auth bootstrap (`App.tsx`).** Keeps its spinner, recorded as the exception in `patterns/loading-states.md`: the destination is `/login` or the app, so a shell skeleton would flash the wrong one.

## Acceptance (live: local test user, held requests, caches cleared)
- (a) Each listed site renders a skeleton with the same structure as its loaded state and no layout shift (measured): PARTIAL.
  - PASS: Accounts (band 98 = 98, rows 57/56 against 56/56, headings at 318); Categories (first row top 320 = 320, row 66 = 66, tabs 40 = 40, after the fix); 13th Month (hero 178 = 178).
  - Home widgets: 419/419/407 grid cells the same loading and loaded. The stat tiles are 139 loading against 163 loaded, because net worth carries an "Excludes PHP balances" note that only exists for some data.
  - Not measured: the loan purchase tracker (no financed purchase was seeded) and the Categories subcategory, rules and Unused skeletons.
- (b) The auth bootstrap no longer shows a bare spinner or the exception is recorded: PASS (exception recorded).
- (c) 13th Month keeps the previous year visible while the next loads: PASS live (2026 stayed, zero skeletons, "Loading 2025…", then 2025).
- (d) Reduced motion shows a static skeleton: PASS live (`animation-name: none` under `prefers-reduced-motion: reduce`).
- (e) Lint, build, test: PASS (666; the encoding test's pinned `{year}` became `{shownYear}`).

## Found in the live check
- Categories: the loaded list sits 8px below the tab strip (Tabs' `gap-2`); the skeleton's did not (`cea253d`).
- `patterns/browser-check-with-local-user.md` steps 9 and 10: how to hold requests to see a skeleton, and two traps (warm cache, single `continueRequest`).

## Backlog
- **Home's first-run checklist** appears only after load and moves everything down 362px. It was not on the ticket's list.
- The net worth note (139 against 163) and forecast recurring items are data-dependent; not reserved.
- The loan purchase tracker, and the subcategory, rules and Unused skeletons, were not measured. Nothing was seeded for them.
- 13th Month: a failed new-year read (old rows dropped, error shown) was not exercised. The refresh is pointer-blocked only, so a keyboard can still toggle a row.
- The Liabilities column skeleton is drawn as three asset-style rows; liability cards are taller. Not measured with a loan or card.
- Light theme skeletons were not looked at.
