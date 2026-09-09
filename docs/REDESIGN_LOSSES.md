# Redesign — removed / unused capabilities

The blue/indigo M3 redesign (`~/Downloads/Application redesign project.zip`) is being
applied **literally to the mockups**. Where a mockup omits an existing feature, the
feature is removed from the UI. This file tracks every such loss so it can be
reconsidered later. Underlying hooks / `lib` / data code is left intact unless noted —
only the UI surface is trimmed.

---

## Phase 1 — Design tokens & primitives

No feature loss. Visual layer only:

- `src/index.css` `:root` / `.dark` / `@theme inline` rewritten from the gold M3 seed
  to the handoff's blue/indigo scheme. Existing shadcn variable names keep their
  meaning; added roles: `--primary-container`, `--on-primary-container`,
  `--secondary-container`, `--on-secondary-container`, `--surface-container`,
  `--surface-container-high`, `--nav-container`, `--outline`, `--outline-variant`,
  `--gold`, `--gold-container`, `--el1`, `--el3` (plus matching `--color-*` /
  `--shadow-*` utilities).
- `[data-slot="card"]` now carries `var(--el1)` instead of `box-shadow:none`.
- `Dialog` content: `rounded-[28px]` + `shadow-[--el3]`.
- `src/constants/colors.ts`: `GOLD` now resolves to `var(--gold)` (was `var(--primary)`);
  added `GOLD_CONTAINER`.
- `ThemeContext`: default accent seed is now `#55659a`; `theme-color` meta updated;
  custom-accent picker also seeds `--primary-container` / `--on-primary-container`.
