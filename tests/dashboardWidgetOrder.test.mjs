import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

// The constant lives in src/lib/dashboardLayout.ts (LED-264). Read it from the source; the test is
// about the two lists agreeing, not about running it.
function codeDefault() {
  const src = readFileSync('src/lib/dashboardLayout.ts', 'utf8')
  const body = src.match(/export const DEFAULT_WIDGET_ORDER[^=]*=\s*\[([^\]]*)\]/)
  assert.ok(body, 'DEFAULT_WIDGET_ORDER not found')
  return [...body[1].matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1])
}

const DEFAULT_RE = /dashboard_widget_order[^;]*?default\s+'(\[[^']*\])'::jsonb/i

function sqlDefault(file) {
  const m = readFileSync(file, 'utf8').match(DEFAULT_RE)
  assert.ok(m, `no dashboard_widget_order default in ${file}`)
  return JSON.parse(m[1])
}

function latestMigrationDefault() {
  const dir = 'supabase/migrations'
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  for (const f of files.reverse()) {
    const text = readFileSync(`${dir}/${f}`, 'utf8')
    if (/alter column dashboard_widget_order set default/i.test(text)) {
      const m = text.match(/set default\s+'(\[[^']*\])'::jsonb/i)
      return JSON.parse(m[1])
    }
  }
  return null
}

test('the latest migration default equals DEFAULT_WIDGET_ORDER', () => {
  assert.deepEqual(latestMigrationDefault(), codeDefault())
})

test('schema.sql default equals DEFAULT_WIDGET_ORDER', () => {
  assert.deepEqual(sqlDefault('supabase/schema.sql'), codeDefault())
})

test('every widget in the default order is listed once', () => {
  const order = codeDefault()
  assert.equal(new Set(order).size, order.length)
  assert.equal(order[0], 'upcomingBills')
  assert.ok(order.includes('recentTransactions'))
})

test('the migration only rewrites rows that still hold the old default', () => {
  const text = readFileSync('supabase/migrations/20260926100000_default_dashboard_widget_order.sql', 'utf8')
  const update = text.match(/update public\.profiles[\s\S]*?;/i)
  assert.ok(update)
  assert.match(update[0], /where\s+dashboard_widget_order\s*=\s*'\["stats","creditCards","cashflowChart","categoryPie","budgets","upcomingBills","cashflowForecast"\]'::jsonb/)
})
