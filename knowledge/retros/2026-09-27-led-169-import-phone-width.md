# LED-169 · Import dialog fits a phone — retro (2026-09-27)

## What shipped
- `ImportCSVDialog.tsx`: `DialogContent` gets `grid-cols-[minmax(0,1fr)]`. The dialog base is a one-column `grid`; an implicit `auto` column grows to its widest child's min-content, so the content was 645px wide in a 339px dialog. Making the column `minmax(0, 1fr)` lets it shrink, and the existing `overflow-x-auto` table wrapper does the sideways scroll. No `whitespace-nowrap` or table change was needed.
- `ui/dialog.tsx` is untouched.

## Measured (dev server, seeded user, 160-row CSV with 7 error rows)
Dialog `scrollWidth / clientWidth`:

| width | before | after |
|---|---|---|
| 375 | **677/339**, account select 32..677 | 339/339, select 32..339 |
| 390 | **677/354** | 354/354 |
| 768 | 764/764 | 764/764 |
| 1280 | 764/764 | 764/764 |

## Acceptance
- (a) No content wider than the dialog at 375 and 390; account select, currency select, summary tiles and the footer button are inside it: PASS. The footer button reads "Fix or skip 7 error rows" (disabled) with errors and "Import 153 rows" (enabled, right edge 339 at 375) with a clean file.
- (b) The table scrolls inside its wrapper: PASS (`scrollWidth` 643 in a 305px wrapper at 375).
- (c) The row Category Select opens inside the viewport: PASS at 375 (popup x 164..308, y 408..807 in 375x844) and 390 (x 179..323).
- (d) 768 and 1280 unchanged: PASS (identical numbers).

## Backlog
- Not tried: a 320px viewport, landscape phones, and a CSV with a very long single description.
- The 390 "Import 153 rows" measurement returned a `top` of 3461 (scroll position after `scrollIntoView`); horizontal position was inside the dialog. Not chased.
