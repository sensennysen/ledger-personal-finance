# LED-78 · Home widget grid and order — retro (2026-09-24)

## What shipped
- Home drops `max-w-7xl` and the 1.5fr/1fr grid: two columns at lg, three at 2xl. Former `lg:col-span-2` wrappers are `col-span-full`.
- Upcoming Bills is a one-line strip: the next four bills with amount and countdown, then "+N more".
- The phone stats card follows the user's widget order. It was pinned to `order: 0`.
- Validate (`000be6e`), at 2xl only:
  - The greeting and date share a line, and the divider goes.
  - Stat cards and dashboard rows are tighter.
  - The chart is 200px and the pie 168px.
  - Dashboard rows get `text-left` (they were centring their text).
  - The empty first-run checklist wrapper hides.

## Acceptance
- Upcoming Bills is a strip: PASS (browser).
- Three columns at 1920 fit the eight default widgets without scrolling: PASS with `DEFAULT_WIDGET_ORDER` and no budget warnings (main scrollHeight 960 = clientHeight 960; it was 1,126). With budget warnings the alert rows add height and it scrolls.
- Mobile shows the first four above the fold, user order respected: PARTIAL. At 390×844 the strip, stats and credit-card monitor fit. The fourth widget's header shows above the bottom nav, but its body doesn't.

## Discovered
- **The database default for `profiles.dashboard_widget_order`** (baseline and `20260507174000` migrations) is `["stats","creditCards","cashflowChart","categoryPie","budgets","upcomingBills","cashflowForecast"]`. It puts Upcoming Bills sixth and leaves out `recentTransactions`.
  - Every new profile gets it, so `DEFAULT_WIDGET_ORDER` (bills first) never applies.
  - In the browser, the strip landed between rows and Budget Progress sat alone in its row.
  - Fixing it needs a migration: a new column default, and possibly updating rows that still equal the old default.

## Backlog
- The widget-order database default above (needs a decision and a migration).
- Pay now on the strip: `UpcomingBill` carries no account id.
- The mobile fourth widget is only partly above the fold. The stats card is 208px on phones.
- Over-budget rows in Budget Progress render gold, not expense. LED-86 covers budgets.
