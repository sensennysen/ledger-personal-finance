# LED-202 · First four Home widgets above the fold at 390 — retro (2026-10-03)

Branch `epics-15-19` at `2e4aee9`. Decision OD-11 (a), a shorter cash flow chart on phones, was revised on 2026-10-03 to "compact the first four" after the measurements below.

## Why the decision changed
LED-211's `pnpm sweep --home-fold` measured the demo user at 390x844, where the bottom nav starts at y=756:
- **Default order** (bills, stats, cards, budgets, …):
  - three widgets fit;
  - Budget Progress started at 767, 11px below the fold, and ended at 1024;
  - the cash flow chart is sixth, so shortening it cannot change the result for anyone on the default order.
- **Old database order** (stats, cards, chart, pie): the chart card (387px) ended at 973. Fitting it would need a card of 169px or less, smaller than its title and tab row.
- **Bills, stats, recent, chart:** the chart started at 917.

Asked with these numbers, you chose to compact the first four on phones to match design 18a's phone frame (bills strip, net worth, card, budgets), and to keep the shorter chart for custom orders.

## What was built
All changes apply below `md` (768px), where Home is one column. Tablet and desktop are unchanged.

**Upcoming Bills.** The strip shows the next bill only (`PHONE_LIMIT = 1`). "+N more" moves into the header. The `md` strip keeps up to four with its own "+N more". The strip loses 4px of vertical padding.

**Budget Progress**
- Two budgets (`PHONE_LIMIT = 2`; desktop keeps four).
- A **See all N** link to /budgets in the header, styled like Recent Transactions' "View all". It is not `text-primary`, which `semanticTokens.test.mjs` bans in status cards.
- The subtitle is hidden.
- The header margin is 10px and row spacing 12px.

**Credit Card Monitor.** The subtitle, the decorative icon box and the "Last payment" line are hidden. The first card row starts 4px higher.

**`DashboardCardHeader`.** It gains `subtitleOnPhone` and `iconOnPhone` (both default true).

**Net Worth (phone card)**
- The two unrated-currency notice wrappers render only when there is a notice. Each empty `mt-2` wrapper took 8px.
- The 32px figure gets `leading-none` (it inherited a 48px line).
- Tile spacing is trimmed by 6px.

**Grid gap.** 12px on phones (`gap-3 md:gap-4`), as in 18a; `md` and up keep 16px.

**Cash flow chart.** `h-40 sm:h-60 2xl:h-48` (chart and skeleton): 160px below 640, unchanged from 640 up.

## Acceptance
- **(a) OD-11 answered: PASS.** (a) in the register; revised to "compact the first four" with your answer, recorded here and in the build order.
- **(b) The answer holds at 390x844, measured: PASS** for the default order. `pnpm sweep --home-fold`, demo user, light:

  | Widget | Before (top–bottom, height) | After |
  |---|---|---|
  | Upcoming Bills | 176–340, 165 | 176–254, 78 |
  | Net Worth | 356–548, 192 | 266–432, 166 |
  | Credit Card Monitor | 564–751, 187 | 444–592, 149 |
  | Budget Progress | 767–1024, 257 | **604–755, 151** (fold 756) |
  | Cash Flow (6th) | 1392–1779, 387 | 1116–1423, 307 |

  The margin is 1px for the demo data (one card, no card reminder line, two or more budgets). See the Backlog.
- **(c) The desktop layout does not change: PASS.** Every Home widget rect at 1280x900 and 1920x1080 is identical before and after (measured with the change stashed, then restored). The `/` contrast scan passes at 390 and 1280 in light and dark (131 and 149 text nodes, 0 below).
- **(d) A customised widget order is unaffected: PASS.** The order logic (`widgetGridStyle`, `useDashboardPrefs`) is untouched. With the old order the page still renders that order. The chart card is 307px instead of 387px, so Net Worth, the card monitor and the start of the chart are on the first screen; the chart ends at 821. With bills, stats, recent, chart, Recent Transactions starts at 444.
- **Checks.**
  - `tests/homeFold.test.mjs` (4) pins the phone classes and that `md`/`sm`/`2xl` keep theirs.
  - `pnpm lint`, `tsc -b`, `pnpm build` and `pnpm test` (856 passing, plus `tests/redesign.mjs`) are green.

## Backlog
- **The fit is data-dependent.** Each of these pushes Budget Progress back over the fold:
  - a card with a payment or statement reminder (one more line);
  - a second credit card;
  - a budget-exceeded alert above the widgets;
  - the first-run checklist;
  - an unrated-currency notice on Net Worth.
  The phone top bar (two rows, LED-30) takes 160px against the design's 116px, and that 44px is the margin the design had.
- **Custom orders still don't fit four.** With the chart or Recent Transactions in the first four, the fold does not hold. The chart is shorter, but its title and tab row (about 130px) stay.
- **The add button overlaps the right end of the second budget's amount** at rest ("$129.95 / $…"). The button floats over content on every page (LED-34 reserves space only at the end of lists).
- **Budget order on phones.** The phone shows the first two budgets in their current order. 18a shows the two closest to or over their limit ("2 over"). Not changed.
