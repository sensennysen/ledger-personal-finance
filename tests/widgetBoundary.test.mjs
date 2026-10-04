import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// LED-243: one broken Home card must not take the page with it, so every widget has its own boundary.
const prefs = readFileSync(new URL('../src/hooks/useDashboardPrefs.ts', import.meta.url), 'utf8')
const page = readFileSync(new URL('../src/pages/DashboardPage.tsx', import.meta.url), 'utf8')
const order = /DEFAULT_WIDGET_ORDER: DashboardWidgetKey\[\] = \[([^\]]+)\]/.exec(prefs)
const keys = order ? [...order[1].matchAll(/'(\w+)'/g)].map((m) => m[1]) : []

test('the default widget order lists the widgets', () => {
  assert.ok(keys.length >= 8, `found ${keys.length}`)
})

for (const key of keys) {
  test(`the ${key} widget has its own error boundary carrying its grid order`, () => {
    assert.match(page, new RegExp(`<DashboardWidgetBoundary widget="${key}" style=\\{widgetGridStyle\\('${key}'\\)\\}>`))
  })
}

test('the forced failure is rendered only in development', () => {
  const boundary = readFileSync(new URL('../src/components/dashboard/DashboardWidgetBoundary.tsx', import.meta.url), 'utf8')
  assert.match(boundary, /\{import\.meta\.env\.DEV && <DevThrow widget=\{widget\} \/>\}/)
})
