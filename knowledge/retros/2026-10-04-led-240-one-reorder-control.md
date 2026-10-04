# LED-240 · One Reorder control on Categories — retro (2026-10-04)

Branch `epics-15-19`. Epic 21, phase B. Decision OD-13 item 8, design 8a: one visible Reorder control, a reorder mode with Done, and no per-row handles.

## What was built
- **`src/lib/reorder.ts`.** `reorderIds`, `moveId` and `mergeSubsetOrder` moved out of `CategoriesPage.tsx` unchanged. Added `moveAnnouncement(name, ids, id)`. Tests in `reorder.test.mjs` (5).
- **Categories list.**
  - The "Category options" ⋯ menu, its only item "Rearrange categories", is gone. A visible **Reorder** button sits before Add Category, hidden with one category or none. It reads **Done** in the mode and has `aria-pressed`.
  - In the mode, every row at every width shows "Move <name> up" and "Move <name> down" and can be dragged with a pointer. Edit and Delete are hidden, and the row's open button leaves the tab order and doesn't open.
  - The matchMedia listener, `isDesktopDrag` and the hidden in-row drag handle are gone, so there is one implementation, not drag above 768px and arrows below.
  - After a move, focus returns to the moved row's button in the same direction, or the other one at an end. An `aria-live="polite"` region reads "Education moved to position 2 of 11."
- **Subcategories in the pane.** "Rearrange" is now "Reorder", with the same buttons, focus and announcement (`ReorderButtons`, `refocusMove`). This removes the second implementation design 8a calls out.

## Acceptance
- **(a) Reorder mode by one control, with Done: PASS.** Browser, 1280 and 375: one "Reorder" button; Done ends the mode.
- **(b) Keyboard reordering works and is announced: PASS.**
  - At 1280, focus on "Move Education down", then Enter twice: focus stays on that button, and the live region reads position 2, then 3 of 11.
  - At 375, at the top, focus moves to "Move Education down" because up is disabled.
  - Subcategories: Coffee down then up, announced as 2 of 2 and 1 of 2.
- **(c) The order persists: PASS.** After a reload at 1280 the list reads Entertainment, Food & Dining, Education. Restored to the seed order afterwards.
- **(d) Checked at 390 and 1280: PASS.** Checked at 375 (the pane's mobile preset) and 1280. No sideways scroll at 375 (`scrollWidth` 375).
- `pnpm lint` and `tsc -b` are clean.

## Not verified
- **Pointer drag.** Only the width gate changed; drag now works at every width. HTML5 drag can't be driven reliably over CDP, and touch screens don't fire HTML5 drag events at all, so on phones the buttons are the way to move.

## Backlog
- **Subcategory order failures still go to the console only** (`persistSubcategoryOrder`, unchanged here). The category list uses the notification surface.
