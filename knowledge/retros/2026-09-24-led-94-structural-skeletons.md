# LED-94 · Skeletons that describe their target — retro (2026-09-24)

## What shipped
- Three hand-rolled pulses were left, not four (the ticket's line numbers predate LED-21/22). They are now `Skeleton`: the two chart areas and the merchant list.
- Structural skeletons: the merchant rows keep the real rank and meter track, Account Balances keep the real row geometry, and the loading table renders the real `<thead>` (shared as `tableHead`) with one text run per visible column. Stat cards reserve their sub and comparison lines. Only text runs are grey.
- `Skeleton` keeps `rounded-md` as the default for text runs. Blocks pass their own radius. There's a comment in `skeleton.tsx`, and the rule is in `knowledge/patterns/loading-states.md` along with the spinner-vs-skeleton-vs-RefreshingRegion rule.

## Acceptance
- Hand-rolled pulses replaced with Skeleton: PASS (all 3 that were left).
- Row grid, icon tile and dividers stay real, only text greys: PASS (code) on Reports.
- Skeleton default radius decided: PASS (rounded-md for text runs, blocks pass their own).
- Spinner/skeleton rule stated and applied: PASS for Reports. The audit found one exception, below.

## Backlog
- `App.tsx:176` shows a full-page spinner during auth bootstrap, which is content arriving. It breaks the rule, but it's outside Reports.
- The other Skeleton call sites (Dashboard widgets, Accounts, Categories, 13th Month, LoanPurchaseTracker) are still flat blocks. 25a's Home first-load design covers the Dashboard ones.
- Not verified live (OAuth). The "no layout shift" claim is by construction, not measured.
