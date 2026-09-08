# Handoff: Material 3 re-skin of Ledger (ledger-personal-finance)

## Overview

Replace the app's "Obsidian Ledger" visual language with a full Material Design 3
scheme, seeded from the existing Ledger gold. The information architecture, data
layer and routing do **not** change. Three screens are specified here — Dashboard
(desktop + mobile), Settings (desktop), and the mobile `BottomNav` shell + More
sheet — in both dark and light themes.

Two substantive additions beyond color:

1. **Named money tokens.** `EMERALD` / `CORAL` / `GOLD` become `--income`,
   `--expense`, `--transfer` (+ `-container` pairs). Transfers get their own hue
   for the first time; gold stops encoding money and is reserved for brand and
   interaction.
2. **Desktop detail pane.** Dashboard stat-card drill-downs open in a 340px right
   pane on `≥md` instead of a modal dialog.

### One further step, kept separate

The re-skin above is deliberately behaviour-neutral. The mobile **navigation and
PWA rework** — four real bottom-nav destinations, the FAB out of the bar, a
global month cycle, unified bottom sheets — is specified separately in
**`NAV-REWORK.md`** against `Ledger M3 PWA.dc.html`. It changes component
structure and state; do the re-skin first, then that. It introduces no new
tokens.

## About the design files

The `.dc.html` files in this bundle are **design references created in HTML** —
prototypes showing intended look and behaviour. They are not production code and
should not be copied into the app. The task is to recreate them inside the
existing codebase: Vite + React 19 + TypeScript, Tailwind v4, shadcn/ui,
react-router, Supabase. Use the app's established patterns (`cn()`, shadcn
primitives, `NavLink`, existing hooks) throughout.

## Fidelity

**High-fidelity.** Colors, type, spacing and radii are final. Recreate
pixel-accurately using the repo's own components. Exact values are in
`tokens/index.css.m3.css`; every hex quoted below has an oklch equivalent there.

## Design tokens

Paste `tokens/index.css.m3.css` over the `:root` / `.dark` / `@theme inline`
blocks in `src/index.css`. Variable names are unchanged, so all shadcn
components inherit with no edits. Keep the existing long `@theme inline` shadcn
mapping list verbatim — nothing in it was renamed.

### Color roles

| Role | Dark | Light |
|---|---|---|
| background / surface | `#15130B` | `#EFE7DA` |
| card / surface-container | `#211F17` | `#FFF8EE` |
| elevated / container-high | `#2A2718` | `#EDE4D6` |
| sidebar | `#1D1B13` | `#F8F1E4` |
| foreground | `#E9E2D4` | `#1E1B13` |
| muted-foreground | `#999080` | `#5A5346` |
| border / outline-variant | `#2C2921` | `#DDD5C4` |
| input / outline | `#4D4739` | `#CFC7B5` |
| primary | `#EDC55F` on `#3E2E00` | `#7A5900` on `#FFFFFF` |
| accent / primary-container | `#594400` on `#FFE18E` | `#FFE18E` on `#261A00` |
| secondary-container | `#4F462B` on `#F2E2BB` | `#E4D8B6` on `#3E3620` |
| **income** | `#9FD9A0` on `#1E3320` | `#1E6B2E` on `#C6EBC7` |
| **expense** | `#FFB4AB` on `#3B1512` | `#A4342B` on `#FFDAD6` |
| **transfer** | `#9EC6EA` on `#16293A` | `#1F5A87` on `#CDE4F7` |

Every pair above clears 4.5:1. Direction is always paired with a sign or arrow —
color is never the only cue.

### Type

- `--font-sans`, `--font-heading`, `--font-display`: **Roboto** (400/500/700).
  Playfair Display is removed.
- `--font-mono`: **DM Mono** — kept, and still used for every currency value.
- Scale in use: display 40/48, headline 20/26, title 16/22, body 14/20,
  label 12/16 and 11/15 uppercase with `.14em` tracking.

### Shape & spacing

`--radius: 0.75rem` (was `0.5rem`). Cards 20px, list items 12px, chips 8px,
inputs `rounded-xl` h-12, filled buttons `rounded-full` h-10, bottom sheets 28px
top corners, mobile FAB 64px / 20px radius, nav items full pills h-11.
Card padding 18-20px desktop, 16px mobile; grid gaps 14-16px.

### Elevation

M3 tonal elevation, not shadows: surface → container → container-high. The only
retained shadows are the mobile FAB (`0 6px 16px rgba(0,0,0,.45)`) and the
bottom sheet scrim.

## Screens / views

Detailed component-by-component layout, plus the exact repo file that renders
each piece, is in **`SCREEN-MAP.md`**. Summary:

### Dashboard — desktop (`A1` dark / `B1` light)
- **Purpose:** cycle overview; drill into income/expense/balance.
- **Layout:** 220px drawer · fluid content · 340px detail pane. Content column:
  60px header (greeting + cycle stepper + widget-settings + "Add transaction"),
  then 18/24px padded stack: alert banner → 3-up stat cards → widget grid
  (`1.5fr 1fr`, gap 14).
- **Stat cards:** 20px radius, `bg-card`, 18px padding. Label 11/15 uppercase
  `.14em` muted; value 28/34 DM Mono in `--foreground` (balance) or
  `--income`/`--expense`; 28px `rounded-lg` icon tile in the matching container;
  delta chip 11/15 with `arrow_upward`/`arrow_downward`.
- **Widgets:** explicit `drag_indicator` handle at 18px `--input` before the
  title (M3 wants a stated drag affordance; today the whole card is draggable).
- **Detail pane:** 56px header (title + count + close), cycle-total card in
  `--income-container`, then rows: 36px `rounded-xl` icon tile, name 14/20,
  meta 12/16 muted, amount 14/20 DM Mono, 1px `--border` separators.

### Settings — desktop (`A2` dark / `B2` light)
- **Purpose:** profile, appearance, preferences, cycle, notifications, account.
- **Layout:** same drawer; content is a two-column card grid on `lg` (was one
  column at any width), 16px gap, `align-content: start`.
- **Notable controls:** colour-scheme pair as filled/outlined pills (44px);
  font size as an M3 segmented button with the four preview sizes retained
  (12/14/16/18px); accent swatches 32px circles, selected gets a
  `0 0 0 2px card, 0 0 0 4px primary` ring plus a check glyph; switches
  52×32 with 24px thumb; destructive actions as outlined + `expense-container`
  filled rather than solid red.

### Dashboard — mobile (`A3` / `B3`)
- 64px top bar (avatar, "Ledger", widget settings), full-width cycle stepper,
  balance card `rounded-3xl` with in/out chips inside, alert banner,
  recent-transactions card.
- **BottomNav:** 80px bar, `rounded-t-[28px]`, `bg-sidebar` + 1px border;
  four labels (Home, Accounts, Transact, More) with a 72px gap for the FAB;
  active item shows a 56×30 `bg-sidebar-accent` pill behind the icon with the
  label in `--sidebar-accent-foreground`. FAB 64px, `--primary`, 28px glyph,
  centred and overlapping the bar top.

### More menu — mobile (`A4` / `B4`)
- The `moreMenuOpen` popover becomes a bottom sheet: 32×4 drag handle, 28px top
  radius, `bg-sidebar`, scrim `rgba(0,0,0,.45)`. Three shortcut tiles
  (Categories / Budgets / Reports) in `bg-card` 18px radius, icons recolored to
  `--transfer` / `--primary` / `--income`; then the theme switch row and the
  Settings row, both 56px.

## Interactions & behaviour

- **Navigation:** unchanged `NavLink` targets and `location.pathname` matching.
  Active state moves from `bg-primary/8` + 2px left bar to the M3 pill.
- **Detail pane (new):** `detailView` state stays in `DashboardPage`. On
  `≥md` render into the `AppLayout` pane slot; below `md` keep
  `DashboardDetailDialogs`. Pane enters with a 200ms `ease-out` slide + fade;
  close via header X or `Escape`.
- **Widget reorder:** unchanged (`useDashboardPrefs` + `useFlipReorder`); the
  drag handle becomes the drag origin on desktop, long-press stays on mobile.
- **Month cycle:** unchanged; the forward chevron stays disabled (`--input` ink)
  when `isCurrentMonth`.
- **Alerts:** unchanged dismiss-to-`dismissedAlerts` behaviour.
- **Motion:** M3 standard easing `cubic-bezier(0.2, 0, 0, 1)`; 200ms for state
  changes, 300ms for the drawer collapse (matches the existing duration-300),
  400ms for sheet entry. Keep `animate-page-in`.
- **States:** skeletons keep their positions but use `--muted`; empty states use
  `--muted-foreground` at body size; error text uses `--expense`.

## State management

No new state except the pane/dialog branch above. Existing:
`theme`/`fontSize`/`accentColor` (`ThemeContext`), `startDay` (`useMonthCycle`),
`prefs` (`usePreferences`), `widgets`/`widgetOrder` (`useDashboardPrefs`),
`chartPeriod`, `selectedMonth`, `detailView`, `dismissedAlerts`
(`DashboardPage`), `createOpen`/`moreMenuOpen` (`AppLayout`).

## Dynamic color (accent picker)

`ThemeContext.accentColor` currently overrides `--primary` directly. Under M3 it
should seed a tonal palette instead, so container/on-container stay legible.
Use `@material/material-color-utilities`:
`themeFromSourceColor(argbFromHex(accentColor))`, then write
`primary`, `on-primary`, `primary-container`, `on-primary-container` for the
active scheme. `--income`/`--expense`/`--transfer` are fixed and must **not**
be re-seeded — money semantics stay stable across accents.

## Assets

- `public/l-white.png` / `public/l-black.png` — existing logo, unchanged
  (mockups draw a gold "L" tile as a stand-in).
- Icons: mockups use **Material Symbols Rounded**; the repo uses **lucide-react**.
  Keeping lucide is fine — the mapping is 1:1 for every icon shown
  (`LayoutDashboard`→`space_dashboard`, `Wallet`→`account_balance_wallet`,
  `ArrowLeftRight`→`swap_horiz`, `Tag`→`sell`, `Target`→`target`,
  `FileBarChart2`→`bar_chart`, `TrendingUp/Down`→`trending_up/down`).
  Swapping to Material Symbols is the last, optional step.
- No new fonts beyond Roboto (Google Fonts); DM Mono is already loaded.

## Files

| File | What it is |
|---|---|
| `Ledger M3 App Reskin.dc.html` | **the spec** — all 8 frames (A1-A4 dark, B1-B4 light) + the token panel |
| `Ledger M3 PWA.dc.html` | **interactive** mobile nav + PWA rework; click the nav bar, FAB, avatar and any transaction row |
| `NAV-REWORK.md` | the behavioural spec for that file: per-component changes, order of work |
| `Ledger M3 Coverage.dc.html` | the remaining 11 surfaces — mobile M1-M7, desktop D1-D4 — plus implementation notes |
| `TASKS.md` | for the developer: eight paste-ready Claude Code prompts, one commit each, reviewed between steps |
| `AUTORUN.md` | for the developer: a single unattended prompt that does the whole change set on a branch, with a run report |
| `Ledger M3 Desktop.dc.html` | earlier desktop exploration: drawer vs. rail, transactions split view, semantic color rationale |
| `Ledger M3 Mobile.dc.html` | earlier mobile exploration: full 8-screen M3 system, Android + iOS deltas, both themes |
| `tokens/index.css.m3.css` | paste-ready replacement for the token blocks in `src/index.css` |
| `tokens/colors.ts` | replacement for `src/constants/colors.ts`, with `txTone()` / `deltaTone()` helpers |
| `SCREEN-MAP.md` | frame → repo file mapping, per-file change list, suggested order of work |
| `COVERAGE.md` | which of the 13 routes are specified, which aren't, and how to treat the ones that aren't |
| `support.js`, `macos-window.jsx`, `android-frame.jsx`, `ios-frame.jsx` | runtime + device frames so the HTML opens offline |

Open the `.dc.html` files in a browser; frame ids (A1, B2…) are shown as badges
above each frame.
