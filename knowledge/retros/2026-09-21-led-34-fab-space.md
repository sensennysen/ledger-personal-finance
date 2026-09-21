# LED-34 — Mobile FAB dead scroll space reclaimed

## Pattern
The FAB was already `position: fixed`, so it never scrolled out of reach. The defect was only the `<main>` bottom padding, 176px against an 88px bottom nav. It now reserves exactly the nav height plus the safe-area inset, and the FAB floats over content.

## Decisions
- `AppLayout` `<main>` padding: `176px` -> `88px` (the `BottomNav` height), `env(safe-area-inset-bottom)` kept.
- FAB position (`104px` above the bottom) and the PWA banner offset (`184px`) unchanged; neither depends on the main padding.
- Per-page bottom padding was not added; nothing was confirmed obscured (see Backlog).

## Backlog
- Not checked in a browser at a mobile viewport: the last row of Transactions, Accounts and Budgets scrolled to the bottom may sit under the FAB (bottom-right overlay). If so, add a small `pb` on that page only.
- The ticket says the FAB "scrolls out of reach", which the code does not show; the wording is likely from an older layout.
- `undo-toast` uses `bottom-18` (72px), which overlaps the 88px bottom nav. Pre-existing, out of scope.
- No test covers `AppLayout` geometry.

## Update 2026-09-22
The first Backlog item was confirmed: at scroll end the FAB covered the last row's trailing controls. Fixed by hiding the FAB within 80px of scroll end (`src/lib/scrollEnd.ts`); `undo-toast` now sits above the FAB. See the Epic 2 wrap-up.
