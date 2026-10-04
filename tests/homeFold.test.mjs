import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// LED-202: Home's first four widgets in the default order (bills, net worth, cards, budgets) sit
// above the bottom nav at 390x844, as design 18a's phone frame does. Measured with
// `pnpm sweep --home-fold`; these pin the phone-only classes that make it fit, and that tablet and
// desktop keep theirs (1280 and 1920 measured identical before and after).
const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')

test('the cash flow chart is shorter on phones only', () => {
  const chart = read('components/dashboard/DashboardCashFlowChart.tsx')
  assert.match(chart, /<div className="h-40 sm:h-60 2xl:h-48">/)
  assert.match(chart, /<Skeleton className="h-40 w-full rounded-xl sm:h-60 2xl:h-48"/)
})

test('phones show the next bill and two budgets; the rest are counted or linked', () => {
  const bills = read('components/dashboard/DashboardUpcomingBillsCard.tsx')
  assert.match(read('lib/upcomingBills.ts'), /const PHONE_LIMIT = 1\b/)
  assert.match(bills, /const STRIP_LIMIT = 4\b/)
  assert.match(bills, /index >= PHONE_LIMIT \? 'max-md:hidden' : ''/)
  const budgets = read('components/dashboard/DashboardBudgetProgressCard.tsx')
  assert.match(budgets, /const PHONE_LIMIT = 2\b/)
  assert.match(budgets, /const DESKTOP_LIMIT = 4\b/)
  assert.match(budgets, /<Link to="\/budgets"[^>]*md:hidden/)
})

test('phones fold warnings and bills into one card right under net worth (M-08)', () => {
  const page = read('pages/DashboardPage.tsx')
  assert.match(page, /\{!phone && visibleAlerts\.length > 0 && \(/)
  assert.match(page, /\{!phone && widgets\.upcomingBills && \(/)
  // Same order as the stats widget, so it follows net worth whatever the widget order.
  assert.match(page, /<DashboardAttentionCard[\s\S]*?style=\{widgetGridStyle\('stats'\)\}/)
  const card = read('components/dashboard/DashboardAttentionCard.tsx')
  assert.match(card, /expanded \? billRows : billRows\.slice\(0, PHONE_LIMIT\)/)
})

test('the phone spacing trims stop at md, so tablet and desktop keep their spacing', () => {
  const page = read('pages/DashboardPage.tsx')
  assert.match(page, /grid w-full min-w-0 gap-3 md:gap-4 /)
  const header = read('components/dashboard/DashboardCardHeader.tsx')
  assert.match(header, /subtitleOnPhone \? '' : 'max-md:hidden'/)
  assert.match(header, /iconOnPhone \? '' : 'max-md:hidden'/)
  const budgets = read('components/dashboard/DashboardBudgetProgressCard.tsx')
  assert.match(budgets, /className="mb-2\.5 md:mb-4"/)
  assert.match(budgets, /space-y-3 md:space-y-4/)
})

test('the net worth card renders a notice wrapper only when there is a notice', () => {
  const page = read('pages/DashboardPage.tsx')
  assert.match(page, /stats\.excludedCurrencies\.length > 0 && <div className="mt-2"><UnratedCurrencyNotice/)
  assert.match(page, /stats\.excludedFlowCurrencies\.length > 0 && <div className="mt-2"><UnratedCurrencyNotice/)
})
