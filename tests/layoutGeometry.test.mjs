import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')
const layout = read('components/layout/AppLayout.tsx')
const bottomNav = read('components/layout/BottomNav.tsx')
const toast = read('components/ui/notification.tsx')
const banner = read('components/layout/PWAInstallBanner.tsx')

const px = (src, re) => Number(src.match(re)?.[1])

test('main reserves exactly the bottom nav height below md', () => {
  const nav = px(bottomNav, /h-\[calc\((\d+)px\+env/)
  const main = px(layout, /<main[^>]*pb-\[calc\((\d+)px\+env/)
  assert.ok(nav > 0)
  assert.equal(main, nav)
})

test('FAB, toast and install banner clear the bottom nav', () => {
  const nav = px(bottomNav, /h-\[calc\((\d+)px\+env/)
  const fab = px(layout, /fixed right-4 bottom-\[calc\((\d+)px\+env/)
  const toastBottom = px(toast, /bottom-\[calc\((\d+)px\+env/)
  const bannerBottom = px(banner, /bottom-\[calc\((\d+)px\+env/)
  assert.ok(fab > nav)
  assert.ok(toastBottom > fab + 56, 'toast sits above the 56px FAB')
  assert.ok(bannerBottom > fab + 56)
})

test('entry-detail pane docks only where it fits beside the full-width Activity list', () => {
  const activity = read('pages/TransactionsPage.tsx')
  // Activity shares the Budgets/Categories container: Tailwind max-w-6xl = 72rem = 1152px,
  // with md:p-6 inside it. The list column and the month rail share that width.
  assert.match(activity, /mx-auto flex w-full max-w-6xl gap-6 p-4 md:p-6/)
  const container = 1152
  const pane = px(layout, /aria-label="Entry detail"\s+className="relative w-\[(\d+)px\]/)
  const dock = px(layout, /const wide = useMediaQuery\('\(min-width: (\d+)px\)'\)/)
  assert.equal(dock, 1920)
  // Activity's month rail (LED-62) sits beside the list at lg+: Tailwind w-64 = 256px.
  const rail = 256
  assert.match(read('components/transactions/MonthJump.tsx'), /aria-label="Month jump" className="sticky top-4 hidden w-64/)
  assert.ok(dock - pane >= container, 'docked at 1920 the whole Activity container keeps its width')
  assert.ok(1024 - pane - 2 * 24 - 24 - rail < 768, 'at lg a docked column would squeeze the list')
  // Below the dock width the pane is an overlay sheet, never a column.
  assert.match(layout, /\{wide && sheet === 'detail' && entry && \(\s*<aside/)
  assert.match(layout, /open=\{!wide && sheet === 'detail'/)
})

test('entry detail below lg is its own sheet, not the add/edit modal', () => {
  assert.match(layout, /side=\{mobile \? 'bottom' : 'right'\}/)
  assert.match(layout, /<Dialog\s+open=\{sheet === 'add' \|\| sheet === 'account'\}/)
  const dialog = layout.slice(layout.indexOf("open={sheet === 'add' || sheet === 'account'}"))
  assert.doesNotMatch(dialog, /<EntryDetail/)
})

test('desktop header stays icon-only until xl so its tools fit at 1024 to 1279 (LED-154)', () => {
  const top = read('components/layout/TopBar.tsx')
  // The desktop header is the one above the `md:hidden` mobile header.
  const desktop = top.slice(top.indexOf('<header className="hidden md:flex'), top.indexOf('<header className="md:hidden'))
  assert.ok(desktop.length > 0)
  // Tab labels, the wordmark and the 240px search field made the row 1168px wide at
  // lg (1024), pushing the theme toggle, Settings and the account menu off-screen.
  assert.doesNotMatch(desktop, /\blg:(?:not-sr-only|inline|block|w-60|px-4|px-3\.5|justify-start)/)
  assert.match(desktop, /sr-only xl:not-sr-only/)
  assert.match(desktop, /hidden xl:inline/)
  assert.match(desktop, /xl:w-60/)
})
