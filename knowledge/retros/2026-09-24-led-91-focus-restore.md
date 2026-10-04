# LED-91 · Focus restore — retro (2026-09-24)

## What shipped (`9159b79`, `7fb4f7f`)
- `DialogContent` and `SheetContent` default `initialFocus` to their own `[data-slot=*-title]`. Titles have `tabIndex={-1}` and `outline-none`. A caller's `initialFocus` still wins.
- Closing uses base-ui's default: the trigger, or the element focused before opening.
- `CommandDialog` points `initialFocus` at the command input. SearchPalette's two inputs lost `autoFocus`.
- AppLayout remembers what opened the add/account dialog and the entry detail, and passes it as `finalFocus`.
  - The FAB unmounts while a sheet is open, so it is remembered as `'fab'` and found again through its ref.
  - A disconnected trigger falls back to base-ui's default.
- The desktop Entry detail `<aside>` is not a dialog. It focuses its `h2` on open and restores focus on close in an effect.
- Removed autoFocus from the first field of the loan-purchase, goal-contribution and save-template dialogs.

## Acceptance (browser, local user)
- On open, focus lands on the heading: PASS.
  - At 1920: 5a kind menu → "Add expense", 5b Repay loan → "Record loan repayment", avatar → "Your account", Add Account, and the Entry detail pane.
  - At 390: FAB → "Add expense", and the entry detail sheet.
- On close, focus returns to the trigger: PASS. Each surface above returns to its trigger: the Add Transaction menu button, Repay loan, the avatar, Add Account, the FAB, and the row, by both Esc and X for the pane.
- Search returns to the Search button, after the fix below.

## Issues found in validate
- Closing the search palette dropped focus on `<body>` (fixed in `7fb4f7f`). The input's `autoFocus` ran before base-ui recorded the previously focused element, so the element it recorded was the input itself.

## Backlog
- `DashboardDetailSurface`'s desktop pane (`#dashboard-detail-pane`) still focuses its close button. It is not a dialog, and it was outside the plan. Give it the same treatment as the Entry detail pane.
- AlertDialog is left on base-ui's default (first tabbable, the Cancel button), following the WAI alertdialog pattern and not the "heading" rule. Confirm with design.
- Opening Search with ⌘K has no trigger, so focus goes back to wherever it was. Not checked.
- The ~30 other dialogs get the new default through the primitive. Only the six above were checked live.
