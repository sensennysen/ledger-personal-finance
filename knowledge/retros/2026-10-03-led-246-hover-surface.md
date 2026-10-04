# LED-246 · Hover tints keep text at 4.5:1 — retro (2026-10-03)

Branch `epics-15-19`. Epic 21, phase A. Filed by LED-211's first sweep.

## Cause
A card or row with a solid `bg-card` hovered to `hover:bg-accent/N`. A hover background replaces `bg-card` rather than layering on it, so the grey page (`--background`) showed through the see-through accent. In light, the budget card's links (`--primary`) fell to 4.26:1 and the transfer amount (`--transfer`) to 4.4:1.

## What was built
- **Token.** `--color-surface-hover: color-mix(in srgb, var(--accent) 50%, var(--card))` in `@theme inline` (`src/index.css`). It sits in `@theme inline`, so the mix resolves where it is used and follows the dark theme and a custom accent. The production CSS also carries a solid `var(--accent)` fallback for browsers without `color-mix`.
- **Three sites now hover to `bg-surface-hover`:**
  - the budget card (`BudgetsPage.tsx` ~1380);
  - the transaction row (`TransactionRow.tsx:106`);
  - the template chips (`TransactionsPage.tsx:621`, not in the ticket but the same pattern).
- **Tests** (`tests/themeContrast.test.mjs`, +16):
  - The hover token must be an sRGB mix of two tokens.
  - Foreground, muted, primary, transfer, income, expense and warning each hold 4.5:1 over it, light and dark. Lowest: light `--primary` 4.98:1.
  - The three sites use it and not a see-through accent.
  - Mutation checks: reverting the row class fails 1 test; mixing with `--background` instead of `--card` fails 3.
- **`pnpm sweep --hover`** (`scripts/sweep.mjs`):
  - It hovers the first six visible elements of each distinct `hover:bg-*` class string on each route and scans the text inside each.
  - Six, not one: the first pass hovered one row per class, which was not a transfer, and missed the bug.
  - README and `patterns/rendered-contrast-scan.md` updated.
- **Filed in passing:**
  - **LED-247**: garbled `â€”` and `â€¦` in `SettingsPage.tsx`.
  - **LED-248**: button hover states, found by the new pass.

## Acceptance
- **(a) Both texts hold 4.5:1 hovered, light and dark: PASS.**
  - **Before.** `pnpm sweep --hover` on the old classes (light): Budgets @390 "View covered transactions" 4.26, "Rollover" 4.28; Activity @390 and @1280 "$200.00" (transfer) 4.4.
  - **After.** Every budget card and transaction row target passes on all eight app routes at 390 and 1280, light and dark.
- **(b) Other hover sites are scanned hovered, and failures listed: PASS.**
  - The sweep covered every `hover:bg-*` element in `main` on the eight app routes.
  - The `hover:bg-accent` sites over a card (`BudgetTable`, `CategoriesPage`, Settings rows) pass.
  - **What still fails is not `hover:bg-accent` (filed as LED-248).** These are the shared `Button` variants:
    - default `hover:bg-primary/85`: 4.39:1 on cards ("Add Account", "Add Budget", "Add Category", "Add"); 4.15:1 on Settings ("Save Changes", "Enable Notifications"), light;
    - destructive `dark:hover:bg-destructive/30`: 4.27:1 ("Delete My Account"), dark.
- **(c) Resting states unchanged: PASS.** The resting contrast scan passes on all 32 route, width and theme combinations.
- `pnpm lint`, `tsc -b`, `pnpm build` and `pnpm test` (877 passing, plus `tests/redesign.mjs`) are green.

## Deviations
- **Fix choice.** The ticket suggested a lighter tint or darker ink. A solid mix keeps the existing hover look (accent over card) and fixes every ink at once, without per-colour hover variants.
- **Template chips** were fixed too, though not named in the ticket. Same pattern, same surface.

## Backlog
- **LED-248**: hovered primary and destructive buttons (above).
- **Hover for custom accents.** The token test covers the two default themes. A custom accent's `--primary` on its own mix is not checked, and neither is `--primary` on `--card` today (`accentTheme.ts` only repairs on-primary and on-container).
- **Sweep reach.** `--hover` covers elements inside `main` with a `hover:bg-*` class. Popovers, dialogs and the nav are not hovered.
