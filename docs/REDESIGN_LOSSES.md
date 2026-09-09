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

---

## Phase 2 — Navigation shell

Files: `src/components/layout/{Sidebar,BottomNav,AppLayout}.tsx`.

**Removed:**

- **Sidebar collapse/expand toggle** and its collapsed-state tooltips. The desktop
  rail is now fixed-width (240px ≥1024, 80px icon rail 768–1023).
- **Sidebar quick theme toggle.** Theme is now changed only in Settings → Appearance
  (Phase 9) and the mobile **More** sheet. `useTheme().toggleTheme` still exists.
- **Categories has no desktop navigation entry.** The handoff's desktop sidebar is
  Home / Accounts / Activity / Budgets / Reports / Settings only. On desktop,
  `/categories` is reachable by URL only; on mobile it's in the **More** sheet.
- **"13th Month" removed from the More sheet** (mockup shows only Categories /
  Reports / Settings). Still reachable via `/thirteenth-month` and, after Phase 8,
  the Reports "13th Month" tab.
- **More sheet no longer shows the account identity block** (name / email /
  "N pending changes"). Identity still appears in the desktop sidebar footer and
  Settings → Profile. Offline/pending status still shows in the mobile header +
  `OfflineBanner`.
- Bottom nav lost its `rounded-t-[28px]` corner (mockup uses a plain top border).

**Changed (not a loss):** bottom nav is now 5 items (Home / Accounts / Activity /
Budgets / **More**); More opens the existing sheet host (`sheet === 'account'`).
FAB is 56px `rounded-[16px]` with `--el3`. Logo is a text "L" badge (was
`l-black/white.png`).
