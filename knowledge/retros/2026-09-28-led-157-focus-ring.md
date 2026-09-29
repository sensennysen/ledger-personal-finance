# LED-157 · Focus ring: browser default outline on four elements — retro (2026-09-28)

## What shipped
- `InteractiveRow` now always includes `focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring` (both the `button` and custom-`Component` branches), so `DashboardTransactionRow` gets the ring it was missing without a per-caller fix. Confirmed via `grep` that `InteractiveRow`'s other three callers (`DashboardCategoryPieCard`, `BudgetsPage`'s budget card, `TransactionsPage`'s template chip) already declared the identical class themselves — additive there, not a visual change (`cn`'s `twMerge` collapses the duplicate).
- Added the same ring class to `TopBar.tsx`'s desktop Search button and Settings `NavLink`, and to `DashboardPage.tsx`'s per-alert "Dismiss warning" button — matching the ring class already used elsewhere in each of those same files.
- Added `tests/focusRing.test.mjs`: a source-grep guard (same shape as `semanticTokens.test.mjs`) checking a bounded block around each of the four sites for `focus-visible:ring-3`.

## Acceptance
- (a) Tab to each of the four elements at 1280 in light and dark, no `outline: auto`, a 3px ring shows: **PASS, re-run live (2026-09-29).** CDP-driven Chrome headless, real `Tab` key dispatch (not scripted `.focus()`, which doesn't reliably trigger `:focus-visible`) from a fresh `/` load at 1280×900, both themes toggled via the real theme button. All four sites were reached and read via `getComputedStyle`: Search, Settings, Dismiss warning (seeded a budget-exceeded alert to render it) and a dashboard recent-transaction row all showed `outline-style: none` and a non-`none` `box-shadow` (the ring) in both light and dark.
- (b) A guard test or lint rule that fails on a focusable primitive without a focus-visible ring: **PASS.** `tests/focusRing.test.mjs`, 4/4 passing (re-confirmed 2026-09-29).
- (c) Ring contrast against its surface measured and recorded: **PASS.** `--ring` aliases `--primary` (`src/index.css`). Computed with the project's own `contrastRatio` (`src/lib/contrast.ts`):
  - Light `--primary` (#55659A) vs `--sidebar` (#EFEEF2, TopBar's header bg): **4.90:1**
  - Light `--primary` vs `--background` (#DEDDE3, page bg behind the Home Dismiss button): **4.19:1**
  - Light `--primary` vs `--card` (#FAF9FB, dashboard row bg): **5.39:1**
  - Dark `--primary` (#A8B4DE) vs `--sidebar` (#1E1D23): **8.16:1**
  - Dark `--primary` vs `--background` (#131218): **9.09:1**
  - Dark `--primary` vs `--card` (#26252E): **7.39:1**
  - All comfortably clear the 3:1 non-text (WCAG 1.4.11) bar this ring needs, in both themes, against every surface it appears on in this fix.
- Lint, build, full test suite (756 + redesign checks): PASS (re-confirmed 2026-09-29).

## Backlog
- `tests/focusRing.test.mjs` guards these four sites specifically; it's not a general lint rule, so a *new* hand-rolled focusable element elsewhere in the app could still ship without a ring undetected. A real ESLint rule (or an AST-based check) would close that gap but wasn't built here — out of scope for this ticket's size.
