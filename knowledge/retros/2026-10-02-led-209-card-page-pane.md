# LED-209 · Card account page at 1024 and the docked pane width — retro (2026-10-02)

Tree tested: branch `epics-15-19` at `ab6a3bc`. This ticket changes one class: the docked entry-detail pane goes from 340px to the 13b design's 380px.

## Method
- Method file: `knowledge/patterns/live-sweep-method.md`.
- Environment: local Supabase, the seeded demo user, Playwright Chromium on the Vite dev server, light theme.
- Measurements: element rects with `getBoundingClientRect`, plus `.truncate` elements whose `scrollWidth` exceeds their `clientWidth`.
- Design references in `design_handoff_ledger_ui_audit/designs/`:
  - LED-98 is section 4a of `Ledger - 2B Screens.dc.html`: a 1920 frame with `grid-template-columns: minmax(0,1fr) 400px`, and a right pane holding Pay this card, Where it went and Account.
  - 13b is in `Ledger - 2B Activity.dc.html`: a docked pane of `minmax(0,1fr) 380px`.
- Pane decision rule (from the plan): measure the list at 340 and at 380. If 380 truncates nothing, set it.

## Results
**3 PASS · 1 FAIL · 0 not checkable**

### FAIL (each has a new ticket in `epic-20-phase-4-sweep-findings-tasks.csv`)

| Ticket | Item | Evidence |
|---|---|---|
| LED-231 | Card account page at 1024: the list column is squeezed to 344px | At 1024 the page keeps three columns: list 344px, side column 320px (x=392), month rail 240px. In the list the search field is 110px ("Search tra…"), the result bar is 392x226 with its count block 208px tall ("40 / transactions / match / of 40 / on this / account · Jul / 2026 – Oct / 2026" stacked beside Newest first, Compact and Export match), and 18 row descriptions are cut ("SWEEP-205 conc…", "Fresh Market groceries"). At 1280 the list is 600px and none of this happens. Expected: at 1024 the list keeps a usable width, for example the side column moves under the band or below the list until xl, or the rail folds into the side column. src/pages/AccountTransactionsPage.tsx:637 (lg:grid-cols-[minmax(0,1fr)_20rem]) plus the MonthRail at lg. Screenshot: `knowledge/retros/shots/209-card-1024-top.png`. |

### PASS

| Item | Evidence |
|---|---|
| Card account page at 1280 against the 4a design (LED-98) | Breadcrumb "Accounts > Visa Platinum"; balance, limit, statement and due in one four-cell band (236, 236, 236, 236px: "Current balance $1,484.30 owed", "Credit limit $5,000.00 30% used", "Statement closes Oct 20 in 18 days", "Payment due Oct 10 in 8 days") with the utilisation bar under it; the side column (320px) carries the design's right pane: Pay this card (Amount to pay, Pay card, last payment and history), Where it went, Account; the list is 600px; nothing truncated, no page overflow. The design (1920 only) gives that pane 400px; the app's lg:grid-cols-[minmax(0,1fr)_20rem] gives 320 at every width. |
| Card account page at 1920 | Same structure; list 760px, side column 320px, month rail beside them (the design's 4a frame has no rail and a 400px pane); nothing truncated, no page overflow. |
| Docked entry-detail pane width: set to the 13b design's 380px | Measured at 1920 on Activity (Sep 2026, 30 rows) with "Fresh Market groceries" open. At 340: pane x=1580, rail 1316–1556, result bar 768x74, rows 720px, 0 truncated. Forced to 380: rail 1276–1516, bar 768x74, rows 720px, 0 truncated, no overflow; the longest description ("Maple Street Apartments rent") fits at 185px. The list is capped at max-w-3xl, so the extra 40px only narrows the empty gap between the list and the rail (286 → 266px). Set: src/components/layout/AppLayout.tsx w-[340px] → w-[380px]. After the change (dev server): pane 380px at x=1540, rail 1276–1516, bar 768x74, 0 truncated, overflow 0; tests/layoutGeometry.test.mjs 5/5 (1920 − 380 = 1540 ≥ list 816 + rail 240). |

## Notes
- (a) The card page is compared with the design at 1024 and 1280, plus 1920. (b) The pane width is set to 380px, with measurements before and after. (c) The FAIL at 1024 has a ticket (LED-231 in `epic-20-phase-4-sweep-findings-tasks.csv`). LED-209 is Done.
- Checks after the change: `pnpm lint`, `pnpm build` and `pnpm test` (818 passing, plus `tests/redesign.mjs`) are all green. `tests/layoutGeometry.test.mjs` reads the pane width from `AppLayout.tsx`, and 1920 − 380 = 1540 still covers the list plus the rail (1056).

## Backlog
- **Home's docked detail pane is also 340px** (`DashboardDetailSurface.tsx:76`). The 17a design gives it 400px. It isn't part of this ticket and wasn't measured. Measure it the same way before changing it.
- **The account page's side column is 320px at every width.** The 4a design draws 400px at 1920. The 1280 and 1920 layouts read well, so this is recorded, not ticketed. LED-231 may change the grid anyway.
