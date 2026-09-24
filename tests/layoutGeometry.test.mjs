import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')
const layout = read('components/layout/AppLayout.tsx')
const bottomNav = read('components/layout/BottomNav.tsx')
const toast = read('components/ui/undo-toast.tsx')
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
  assert.ok(toastBottom > fab + 64, 'toast sits above the 64px FAB')
  assert.ok(bannerBottom > fab + 64)
})

test('entry-detail pane docks only where it fits beside the full-width Activity list', () => {
  const activity = read('pages/TransactionsPage.tsx')
  // Tailwind max-w-3xl = 48rem = 768px, plus md:p-6 on both sides.
  assert.match(activity, /p-4 md:p-6 space-y-4 max-w-3xl mx-auto/)
  const list = 768 + 2 * 24
  const pane = px(layout, /aria-label="Entry detail"\s+className="relative w-\[(\d+)px\]/)
  const dock = px(layout, /const wide = useMediaQuery\('\(min-width: (\d+)px\)'\)/)
  assert.equal(dock, 1920)
  assert.ok(dock - pane >= list, 'docked at 1920 the list keeps its capped width')
  assert.ok(1024 - pane < list, 'at lg a docked column would squeeze the list')
  // Below the dock width the pane is an overlay sheet, never a column.
  assert.match(layout, /\{wide && sheet === 'detail' && entry && \(\s*<aside/)
  assert.match(layout, /open=\{desktop && !wide && sheet === 'detail'/)
})
