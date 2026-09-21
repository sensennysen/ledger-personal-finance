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
