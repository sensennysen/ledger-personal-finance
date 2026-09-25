import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')

test('GOLD is its own token, not an alias of the accent', () => {
  const m = /export const GOLD = '([^']+)'/.exec(read('constants/colors.ts'))
  assert.ok(m, 'GOLD export missing')
  assert.notEqual(m[1], 'var(--primary)')
  assert.equal(m[1], 'var(--gold)')
})

// Files whose colour means warning, pending or liability due. --primary is accent, links and active state.
const STATUS_FILES = [
  'components/layout/OfflineBanner.tsx',
  'components/dashboard/DashboardUpcomingBillsCard.tsx',
  'components/dashboard/DashboardBudgetProgressCard.tsx',
  'components/dashboard/DashboardCreditCardMonitor.tsx',
  'lib/utilizationTone.ts',
]

for (const file of STATUS_FILES) {
  test(`${file} does not use --primary for a status meaning`, () => {
    const lines = read(file)
      .split('\n')
      // The Syncing state is an active sync, not a pending one, so it keeps the accent.
      .filter((line) => !/^\s*syncing:/.test(line))
    const offenders = lines.filter((line) => /var\(--primary\)|\b(?:bg|text|border)-primary\b/.test(line))
    assert.deepEqual(offenders, [])
  })
}
