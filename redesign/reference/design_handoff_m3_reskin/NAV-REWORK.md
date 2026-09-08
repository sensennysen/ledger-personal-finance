# Navigation & PWA rework — `Ledger M3 PWA.dc.html`

The re-skin (`SCREEN-MAP.md`) changes tokens and classes only. **This document is
the one part of the handoff that changes behaviour and routing.** Do the re-skin
first; this sits on top of it and reuses its token layer unchanged.

The mockup is interactive — click the nav bar, the FAB, the avatar and any
transaction row to see the target behaviour before writing code.

---

## 1 — `BottomNav.tsx`: four destinations, no `More`, no centre FAB

Today's `navItems` has a fake destination: `More` points at `/settings` but is
wired to `onMoreMenu` and never navigates, so its "active" state is a popover
flag rather than the route. Replace it:

```ts
const navItems = [
  { to: '/',             label: 'Home',     icon: LayoutDashboard,  exact: true },
  { to: '/accounts',     label: 'Accounts', icon: Wallet },
  { to: '/transactions', label: 'Activity', icon: ArrowLeftRight },
  { to: '/budgets',      label: 'Budgets',  icon: PieChart },
]
```

Everything else in the component simplifies:

- **Delete** the `insertIndex` gap `<div className="w-16 shrink-0" />` and the
  absolutely-positioned FAB button — the FAB is no longer part of the bar.
- **Delete** the `isMore` branch, so every item is a plain `NavLink`. Props
  `onAddTransaction` / `addTransactionOpen` / `onMoreMenu` / `moreMenuOpen`
  all come off `BottomNavProps`.
- **Active state** becomes the M3 indicator: a `w-[60px] h-8 rounded-full
  bg-sidebar-accent` pill behind the icon (icon `fill=1`, ink
  `--sidebar-accent-foreground`), label always visible below it at 12/16 in
  `--foreground`. Inactive: transparent pill, icon + label
  `--muted-foreground`. No `bg-primary/15` box, and the icon no longer changes
  size between states (that 18→16px shrink made active items look smaller).
- Bar: `h-[88px] rounded-t-[28px] bg-sidebar border-t border-sidebar-border`,
  `pt-3`, items `flex-1`. Drop the `backdrop-blur` layer — M3 uses tonal
  elevation, and the blur cost a repaint on every scroll frame.
- Keep `md:hidden fixed bottom-0 z-50`; add
  `pb-[env(safe-area-inset-bottom)]`.

Rename the label only (`Transact` → `Activity`); the route stays
`/transactions`.

**Routing:** `/budgets` is promoted from a More-menu shortcut to a bar
destination. `App.tsx` already registers it — no route changes needed. `Home`
keeps `exact`; the other three use `startsWith`, so
`AccountTransactionsPage` (`/accounts/:id/transactions`) correctly keeps
`Accounts` lit.

## 2 — `AppLayout.tsx`: one sheet host, three sheets

The mobile shell currently mixes patterns: `moreMenuVisible` is a popover, add
is a dialog, and transaction detail is a page push. Unify on M3 bottom sheets.

- Replace the `moreMenuVisible` popover (≈ lines 90-140) with an **account
  sheet** opened from the top app bar avatar — not from the nav bar. Contents:
  identity row (avatar, name, email + last-sync), a 4-up tile grid
  (Reports / Categories / 13th Month / Settings), the theme row, sign out.
  The three existing shortcut tiles keep their handlers; add Settings and
  drop Budgets (now a nav destination).
- **Add sheet** replaces the `createOpen` dialog on mobile (`md:` keeps the
  dialog). See §3.
- **Detail sheet** for a tapped transaction row, so the list keeps its scroll
  position instead of pushing a route.

One `sheet: 'add' | 'account' | 'detail' | null` state in `AppLayout` replaces
`createOpen` + `moreMenuVisible`; a single scrim and a single
`rounded-t-[28px] bg-elevated` container with a 32×4 drag handle serve all
three. Entry 260ms `cubic-bezier(.05,.7,.1,1)`, scrim 180ms; dismiss on scrim
tap, drag-down past 25%, and `Escape`.

## 3 — FAB and the amount-first add sheet

`w-16 h-16 rounded-[20px] bg-primary shadow-lg`, positioned
`fixed right-4 bottom-[104px] z-40` — above the bar at the M3 bottom-end
position, out of the item row. Hide it on `/settings` and while a sheet is open.

The sheet is ordered by what the user actually decides first:

1. Type — segmented `Expense | Income | Transfer`, h-11 `rounded-full`
   outlined, selected fill `--accent` / ink `--accent-foreground`.
2. Amount — 52/58 DM Mono, coloured by type (`--expense` / `--income` /
   `--transfer`), with a 3×4 keypad (`.` and `⌫`) instead of the OS keyboard.
3. Category — horizontally scrolling chips of the user's five most-used.
4. Save.

Account, date and note collapse behind a "More details" row, pre-filled with
the default account and today. Three taps to log a typical expense.

## 4 — Global month cycle

Move the cycle stepper out of `DashboardPage` into the mobile shell, directly
under the app bar: 36px prev/next circles either side of a full-width
`--accent` pill reading the range and open/closed state. `useMonthCycle` and
`selectedMonth` lift from `DashboardPage` to `AppLayout` (or a small context)
so Home, Activity and Budgets read the same cycle. Forward chevron stays
disabled when `isCurrentMonth`.

## 5 — PWA state

- `OfflineBanner.tsx` — pins under the status bar (not inline in content),
  `bg-expense-container` / ink `--expense`, `cloud_off` glyph, and states the
  **pending count**: "Offline — 3 entries will sync when you reconnect".
- `PWAInstallBanner.tsx` — a floating card at `bottom-[104px]`, `bg-elevated`
  + 1px `--input`, 20px radius, filled Install button; dismissal persists in
  `localStorage` rather than reappearing per session.
- Add `pb-[env(safe-area-inset-bottom)]` on the nav bar and every sheet, and
  `pt-[env(safe-area-inset-top)]` on the app bar, for `display: standalone`.

## Order of work

1. Re-skin token layer + `ui/*` pass (`SCREEN-MAP.md` steps 1-2).
2. `BottomNav.tsx` rewrite + `PieChart` import (§1).
3. `AppLayout.tsx` sheet host, avatar entry point, FAB (§2-3).
4. Lift `useMonthCycle` / `selectedMonth` (§4).
5. Banners + safe-area insets (§5).
6. Desktop: unchanged by this document — the drawer keeps all destinations.

## Not changing

Data hooks, Supabase, `App.tsx` routes, `types/index.ts`, desktop `Sidebar.tsx`,
and every token in `tokens/index.css.m3.css`.
