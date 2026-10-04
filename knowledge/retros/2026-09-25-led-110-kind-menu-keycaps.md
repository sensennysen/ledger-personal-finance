# LED-110 · E / I / T key caps on the kind menu — retro (2026-09-25)

## What shipped
- `KIND_SHORTCUTS` (`expense: 'E'`, `income: 'I'`, `transfer: 'T'`) and `kindForShortcut` in `src/lib/kindMenu.ts`. The three primary items carry a `shortcut`; loan repayment and card payment do not.
- The dropdown shows a `DropdownMenuShortcut` cap per item and has an `onKeyDown` on the popup: an unmodified E, I or T closes the menu and calls `onSelect`, so the letter selects instead of only moving focus through base-ui typeahead. The menu is controlled (`open`) to close it.
- `SearchPalette`'s `ACTIONS` read their `key` from `KIND_SHORTCUTS`. Its arrow-first gating is unchanged.

## Acceptance criteria
- (a) Key caps E, I, T on the three primary kinds in the dropdown: PASS (browser).
- (b) The key opens the matching dialog, proved by selection: PASS (browser: `i` opened "Add income" with focus on the dialog title, and `l` left the menu open). Not a committed test; `node --test` cannot drive the menu.
- (c) No letter for Loan repayment or Card payment: PASS (unit: shortcuts are `E, I, T` then none; browser).
- (d) `SearchPalette` reads the same constant: PASS (test on the import and on the absence of `key: 'E'`).
- (e) No key caps in the sheet: PASS.
- (f) Lint, build, test: PASS (480/480).

## Backlog
- Only `i` and `l` were pressed in the browser; `e` and `t` go through the same code path.
- The handler sits on the popup, not on each item, so a letter typed while the menu is closed does nothing (by design, as in the spec).
- The keydown handler runs after base-ui's own; typeahead may focus a row for a frame before the menu closes. Not visible in the check.
