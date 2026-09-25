# LED-109 · Kind menu as a bottom sheet below md — retro (2026-09-25)

## What shipped
- `TransactionKindMenu` renders a bottom `Sheet` below 768px (`useMediaQuery('(max-width: 767px)')`, the query `AppLayout` uses) and the dropdown above it. Both read the same `primary` and `liabilities` arrays from one `kindMenuItems` call.
- Sheet: drag-handle bar, 17px title, rows `min-h-16` with a 44px tile, a one-line truncated description and a trailing chevron, and an 8px page-ground band before "Liabilities". Choosing a row closes the sheet and calls `onSelect`.

## The FAB does not open this menu
The spec and ticket say the phone FAB is the trigger. It is not: `AppLayout.tsx` calls `openAddTransactionModal('expense')` straight from the FAB, and has since the M3 translation (`1fdb130`). The menu's phone triggers are the "Add transaction" buttons on Activity (and its empty state) and the account page. The FAB was left as a one-tap expense; LED-111's Change kind is the way back from a mis-pick. If the FAB should open the sheet, that is a product call and one prop in `AppLayout`.

## Acceptance criteria
- (a) Bottom sheet with handle, title, 64px rows, chevron below md: PASS (browser at 390: rows 64px, tiles 44px).
- (b) Dropdown at md and above: PASS (browser at 1280).
- (c) One item list, a test asserts the two surfaces render the same ids in the same order: PARTIAL. `node --test` cannot render React, so the test asserts one `kindMenuItems(` call and that both surfaces map `primary` and `liabilities`. Rendered parity was read in the browser (the same five labels in the same order).
- (d) No key caps in the sheet: PASS (browser: none; test slices the sheet branch).
- (e) Descriptions fit on one line at 390 wide: PASS (browser, longest is "BPI Rewards Visa · $1,240.00 due").
- (f) Focus to the heading on open, back to the trigger on close: PASS for the "Add transaction" button (browser: `sheet-title` focused, Escape returns to the button). The FAB is not a trigger of this menu, see above.
- (g) Lint, build, test: PASS.

## Backlog
- The handle is decorative. There is no swipe-to-dismiss beyond what the base-ui dialog gives.
- Not checked on a real iOS device (safe-area padding uses `env(safe-area-inset-bottom)`), in the light theme, or from the account page trigger.
- If the viewport crosses 768px with either surface open, the open one unmounts without ceremony.
