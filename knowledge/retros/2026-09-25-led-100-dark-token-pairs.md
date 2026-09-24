# LED-100 · Dark token pairs — retro (2026-09-25)

## Premise corrected
The ticket (CSV row and `specs/tickets.md`) says "`index.css` already ships complete token pairs". It didn't. Both themes shipped the old gold M3 palette, while the design (2B Screens `:root` / `body.dark`) is neutral/indigo in both. At /plan we widened the scope to **both themes** (user decision), so the toggle no longer switches brand hue.

## What shipped
- `src/index.css`: both blocks re-seeded from the design tokens. Variable names are unchanged. There is a new `--warning` / `--warning-container` pair with `@theme` utilities. Dark on-primary is `#1B2135`.
- Two deviations from the design, both commented inline:
  - Light `--transfer` is `#3D6B8F` (design `#3F6E93` is 4.43:1 on its container; 13th Month puts body text there).
  - Light `--muted-foreground` is ink-2 `#55545B` (design ink-3 `#6B6A72` is 3.96:1 on the page).
- `src/lib/categoryTint.ts` + `src/hooks/useCategoryInk.ts`: stored category, account and goal hues step 500 → 400 in dark, applied at render sites in 10 files.
- `ThemeContext`: the default accent is `#55659a`. A stored legacy `#c79144` is read as the default, so existing users don't get a gold M3 override. theme-color meta, `index.html` and `manifest.json` are now `#131218` / `#DEDDE3`.
- Hardcoded colors replaced with tokens:
  - Yellow/amber warning callouts (8 places) and the blue rollover badge.
  - `hover:bg-white/N` in TopBar and the dashboard row, which was invisible in light.
  - Notification action `bg-white/15`, which did nothing on the light dark-mode primary.
  - Reports grid rgba and the ImportCSV oklch literal.
  - Scrollbar thumb.
  - Color-picker ring (`white`, plus an invalid `hsl(var(--border))`).
- Tests: `contrast.ts`, `categoryTint` (5), `themeContrast` (35 pair checks + on-primary not white), `hardcodedColors` guard.

## Acceptance
- Every screen renders in dark with no hardcoded light value: PASS.
  - Guard test is clean.
  - Rendered scan of Home, Activity, Accounts, Budgets, Reports, Categories, Settings and 13th Month at 1280 and 390: page `#131218` everywhere.
  - The only light surfaces are primary buttons, meter fills and 10%-opacity decorative blobs.
- LED-32 toggle switches it: PASS. `ledger-theme` light/dark gives `--primary` `#55659A` / `#A8B4DE` and the matching meta color.
- Body text 4.5:1: PASS in both themes. Token test, plus the rendered scan after the muted-ink fix. Before that fix the light scan failed ~170 text nodes.

## Backlog
- Home "Spending by category" legend prints amounts in the category hue on the light card. Several fail 4.5:1 (`#EAB308` 1.83, `#22C55E` 2.17, `#F97316` 2.67). This predates LED-100 and is light only; dark tints pass. Use foreground ink with a swatch dot.
- 13th Month "–" placeholder uses `text-border` (1.27 dark / 1.36 light). It's decorative, but reads as missing data.
- The wordmark dot in `public/l-black.png` / `l-white.png` is yellow-green, from the gold era. It's a brand asset outside the token system.
- `CategoriesPage` offers 15 swatches, while Settings and `types/index.ts` offer 10. Pickers disagree; all 15 have dark tints.
- `categoryBreakdown.ts` falls back to `#888`, which has no tint (it's mid-grey and reads in both themes).
- The accent override still uses `themeFromSourceColor` for non-default accents, so a custom accent drops the designed dark on-primary for M3's. That's acceptable, but it hasn't been checked for contrast.
