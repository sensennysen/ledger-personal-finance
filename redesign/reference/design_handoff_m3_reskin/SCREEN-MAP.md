# Screen map — M3 re-skin → ledger-personal-finance

Every mockup frame, the repo files that render it today, and what changes.
Frame ids match the badges in `Ledger M3 App Reskin.dc.html` (A = dark, B = light).

---

## A1 / B1 — Dashboard, desktop

**Renders today from**

| File | Role | Change |
|---|---|---|
| `src/pages/DashboardPage.tsx` | page shell, `StatCard` (local component), month-cycle stepper, alert list, widget grid | token classes; `StatCard` accent from `--income`/`--expense`; detail opens pane not dialog |
| `src/components/layout/AppLayout.tsx` | flex shell, `main` scroll container, add-transaction dialog | add right-pane slot; `pb-24 md:pb-0` unchanged |
| `src/components/layout/Sidebar.tsx` | desktop nav, collapse, theme toggle, avatar/sign-out | active item → `bg-sidebar-accent` pill `rounded-full h-11`; drop the 2px left bar |
| `src/components/dashboard/DashboardCashFlowChart.tsx` | Recharts bars + period toggle | series → `var(--chart-2)`/`var(--chart-3)`; toggle → M3 segmented button |
| `src/components/dashboard/DashboardBudgetProgressCard.tsx` | budget rows | over-budget row ink → `--expense`; track → `--input` |
| `src/components/dashboard/DashboardUpcomingBillsCard.tsx` | bills list | due-soon row → `bg-expense-container` |
| `src/components/dashboard/DashboardRecentTransactionsCard.tsx`, `DashboardTransactionRow.tsx` | tx rows | 40px `rounded-xl` leading icon in `*-container`; amount in `txTone(kind).ink` |
| `src/components/dashboard/DashboardCategoryPieCard.tsx`, `DashboardCreditCardMonitor.tsx`, `DashboardCashFlowForecastCard.tsx` | remaining widgets | card radius 20px, `bg-card`, drag handle visible |
| `src/components/dashboard/DashboardCardHeader.tsx` | shared widget header | now carries the explicit `drag_indicator` handle |
| `src/components/dashboard/DashboardDetailDialogs.tsx` | stat-card drill-down | **behaviour change** — see below |
| `src/hooks/useDashboardPrefs.ts`, `useFlipReorder.ts` | widget order + FLIP animation | unchanged |
| `src/hooks/useDashboardData.ts`, `useSpendingAlerts.ts`, `useMonthCycle.ts` | all data | unchanged |

**The one behavioural change:** `DashboardDetailDialogs` currently opens a modal
for `detailView`. On `≥md` render the same content in a 340px right pane inside
`AppLayout` (state stays `useState<DashboardDetailView>` in `DashboardPage`);
below `md` keep the dialog. Nothing about the data or the trigger changes.

---

## A2 / B2 — Settings, desktop

| File | Role | Change |
|---|---|---|
| `src/pages/SettingsPage.tsx` | all eight `Card` sections | single column → `lg:grid-cols-2` masonry; cards `rounded-[20px]` |
| — Appearance block (lines ~235-305) | scheme / font size / accent | scheme buttons → filled-vs-outlined pills; font size → M3 segmented button; accent unchanged |
| — Preferences, Notifications, Month Cycle | `Select`, `Switch`, `Label` | shadcn primitives inherit tokens; only radius + height change (inputs h-12, `rounded-xl`) |
| — Account (destructive) | sign out / delete | outlined + `bg-expense-container` filled, not solid red |
| `src/components/ui/*` | card, select, switch, input, button, badge | radius via `--radius: 0.75rem`; buttons `rounded-full`, h-10 |
| `src/contexts/ThemeContext.tsx` | `theme`, `fontSize`, `accentColor` | `accentColor` should re-seed the M3 palette — see README "Dynamic color" |

---

## A3 / B3 — Dashboard, mobile (BottomNav shell)

| File | Role | Change |
|---|---|---|
| `src/components/layout/BottomNav.tsx` | 4 items + centre FAB | FAB → 64px, `rounded-[20px]`, `shadow-lg`; active item → 56×30 `bg-sidebar-accent` pill above the label, not a tinted box; bar `rounded-t-[28px]` |
| `src/pages/DashboardPage.tsx` | same page, mobile grid | balance card `rounded-3xl` with in/out chips inside |
| `src/components/layout/OfflineBanner.tsx`, `PWAInstallBanner.tsx` | banners | `bg-expense-container` / `bg-accent` |

Hit targets stay ≥48px; the 72px FAB gap in the item row is unchanged.

## A4 / B4 — More menu, mobile

| File | Role | Change |
|---|---|---|
| `src/components/layout/AppLayout.tsx` (lines ~90-140) | `moreMenuVisible` popover | becomes an M3 bottom sheet: drag handle, `rounded-t-[28px]`, `bg-sidebar`; the three shortcut tiles, theme switch and Settings row keep their handlers |
| — tile icon colors | `text-teal-400` / `text-violet-400` / `text-amber-400` | → `--transfer` / `--primary` / `--income` so mobile matches desktop |

---

## Files that need no edits

`src/hooks/*` (all data + prefs), `src/lib/*`, `src/contexts/AuthContext.tsx`,
`supabase/*`, routing in `src/App.tsx`, `src/types/index.ts`.
The re-skin is a token + class change; no props or queries move.

## Order of work

1. `src/index.css` token layer + `src/constants/colors.ts` (whole app shifts at once)
2. `src/components/ui/*` radius/height pass
3. `Sidebar` + `BottomNav` + `AppLayout` (the shells)
4. `DashboardPage` and its widgets
5. `SettingsPage` two-column pass
6. Detail-pane behaviour on `≥md`
7. Optional: lucide → Material Symbols Rounded
