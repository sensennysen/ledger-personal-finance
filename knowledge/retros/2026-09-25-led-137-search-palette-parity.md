# LED-137 · Search palette parity — retro (2026-09-25)

## What shipped
- `globalSearch.ts` (pure): `mergeCategoryResults` now ranks by match count, with a name match as the tie-break, so a heavy match is not hidden behind name-only matches under the cap of 3. New: `highlightParts`, `groupChips`, `resolveChip`, `chipShows`, `categoryActions`, `budgetEditPath`.
- `SearchPalette`: a chip row (All plus each group with results, true totals) with the cycle-scope toggle at its right end; `<mark>` highlighting (`text-warning` on `bg-warning-container`); emoji tiles; a visible "Only in <account>" toggle beside the ⌘F path; "New expense in <category>" and "Edit the <category> budget" rows in the Actions group.
- `useBudgetIndex` (category id -> budget id, read once someone types; a failure joins the palette's error). `AppLayout.openAddTransactionModal` takes `categoryId`, passed to the form's `defaultValues`. `BudgetsPage` reads `?edit=<id>`, opens that budget's editor once loaded, clears the param, and says so when the budget no longer exists.
- Tests: ranking (heavy match vs three name-only matches, then the cap), highlight (case, regex characters, amount queries), chip totals equal `capGroup` totals, chip fallback, category actions, edit path. The old "name matches first" test was replaced: the ticket names that order as the bug.

## Decisions
- **Category actions live in the Actions group**, as 16a draws them, not as sub-items under each category row. The Actions chip count includes them. `E` on a highlighted "New expense in <category>" runs it, like the generic actions.
- **The scope toggle moved into the chip row** (16a), not into the Transactions group heading as the ticket says.
- **The chip row wraps** on a phone. First version scrolled sideways and clipped the fifth chip behind a scrollbar (found live at 375).
- Chips and the scope toggle are tabbable (only the hand-off link keeps `tabIndex={-1}`).

## Acceptance
- (a) Chips with counts filter the groups: PASS live (Categories chip left only the Categories group; Actions chip only the four action rows).
- (b) `<mark>` highlight, contrast in both themes: PARTIAL. The pair is `--warning` on `--warning-container`, already held to 4.5:1 in both themes by `themeContrast`; the palette itself was only looked at in the dark theme.
- (c) Both category actions work: PASS live. "Edit the Groceries budget" landed on `/budgets`, opened the editor and cleared `?edit`; "New expense in Groceries" opened the form with 🛒 Groceries chosen.
- (d) A phone can scope to an account: PARTIAL. The "Only in Everyday Checking" control shows at 375. Pressing it was not exercised; it flips the same `accountScoped` state as ⌘F.
- (e) Ranking tested: PASS.
- (f) 1920, 768, 390: PASS (dark theme only).
- (g) Lint, build, test: PASS (589/589).

## Backlog
- Light-theme look of the palette (highlight, chips) was not viewed.
- Press the phone account toggle and confirm the counts narrow.
- 16a's "84% of budget used · 23 transactions this cycle" line on a category row is not built: it needs the budget maths in the palette.
- `useBudgetIndex` returns the first budget when a category has several.
- Offline, "Edit the budget" is simply absent (no error), because editing needs the network anyway.
