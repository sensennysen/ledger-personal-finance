# LED-149 · Density leftovers — retro (2026-09-26)

## What shipped (`256d972`, fix `4709dd0`)
- **Home ranked bars.** `DashboardCategoryPieCard` runs `rollupBreakdown` on Home's list: a pie at 12 categories or fewer, ranked bars with an Other row above. `RankedBars` is exported from `CategoryBreakdownCard` and takes a `resetKey` (the month label) that remounts the Other row, so it closes when the cycle changes. Ranked mode puts the "open details" button on the header only, because the Other row is a button and a button cannot sit inside one.
- **One minus sign.** `netSign.ts` (`MINUS` = U+2212, `signPrefix`) feeds `formatNet` (result bar, day header, month jump), `TransactionRow`, and the other on-screen money signs (Recent Transactions, the forecast card, detail dialogs, the import preview, templates). The PDF export keeps a hyphen.
- **One sign rule.** `amountDisplay` (in `transactionWindow.ts`) returns sign, size and currency and builds on `signedAmount`, so the row, the day header and the result-bar sum cannot disagree. Two display-only rules: an outgoing transfer shows no sign, and money arriving is carried at the rate.
- **Cross-currency (item 5).** `to_account.currency` is already selected, so an incoming transfer is labelled and netted in the destination currency (`signedCurrency`, used by the row, `sumByCurrency`, `groupByDay` and the month nets). Live: the peso account shows `+₱5,600.00` on the row and the day header for a $100 transfer at 56.
- **Compact on a phone.** `effectiveDensity(pref, mobile)`; the stored preference is untouched.
- **FAB and month bar.** The FAB lifts to 160px while a `[data-month-jump-bar]` is on the page (CSS `:has()`, no state).
- **Result bar controls.** Export match (the whole filtered set, in screen order, Standing Balance from `buildRunningBalanceMap`), Select in the phone month bar, and "Top categories, this filter" in the rail (`FilterTopCategories`, one currency, says when others are left out).
- **Virtualisation (item 9).** Not built. LED-125 has not run, so there is no measurement.

## Found in the live check (`4709dd0`)
- Home called `groupExpensesByCategory` with its default `limit = 8`, so the ranked view could never appear. Now uncapped (`knowledge/patterns/do-not-cap-data-before-a-ranking-view.md`). The details dialog now lists every category.
- The month-jump bar's `bottom-[calc(88px+...)]` counted `main`'s bottom padding twice and floated 88px above the nav (`knowledge/patterns/sticky-offset-is-inside-scroller-padding.md`). It is `bottom-0` now. At 390x844 the unlifted FAB (676-740) overlapped the bar (700-756); lifted, it is 620-684, clear at scroll top and bottom.

## Acceptance
- (a) Home shows ranked bars with an Other row above 12 categories and a pie at or below: PASS live for the ranked side (27 categories, "Other · 19 categories"). The pie side is unchanged code; not re-run with 12 or fewer.
- (b) The Other expander closes on cycle change: PASS live (opened in September; after Previous cycle, August showed Other with `aria-expanded="false"`).
- (c) Nets and sums use U+2212 everywhere, from one function with a test: PASS (`netSign.test.mjs`; live: 68 U+2212 signs on Activity and no `-$`).
- (d) `TransactionRow` uses `signedAmount`: PASS (through `amountDisplay`, with parity tests).
- (e) Compact density is ignored below the breakpoint: PASS live (compact preference: dense rows at 1280, `p-3` rows at 390).
- (f) The FAB no longer overlaps the mobile month bar, measured at 390x844: PASS live (above).
- (g) Export match exports exactly the filtered rows: PASS live (98 lines for "98 transactions match" on Activity and on the account page). The filename is `ledger-activity_<cycle>.csv` and `ledger-<account>.csv`.
- (h) The LED-125 measurement decides (9) and is recorded: PARTIAL. Recorded as not measured; the decision waits for phase 12.
- (i) Lint, build, test: PASS (666).

## Backlog
- The filter, Select and Top categories were checked on Activity and the account page at 1280 and 390 only; no tablet width (the bar and rail are both hidden between `md` and `lg` in different ways).
- Top categories counts one currency (the one with the most expenses) and says so; a multi-currency filter has no combined view. Not seen live with two expense currencies.
- The Home ranked card is taller than the pie card in its grid row. Not checked against the widget grid at 1920 or with a customised widget order.
- Select in the phone bar only exists on Activity; the account page has no bulk select to toggle.
- Export on a very large history builds the running-balance map on click; not timed.
- 2,000 mounted rows: unmeasured (LED-125).
