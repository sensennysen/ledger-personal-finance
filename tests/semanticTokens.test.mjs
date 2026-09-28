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

test('utilisation tone is a fill; it passes through --gold, so it is never text colour', () => {
  const src = read('components/dashboard/DashboardCreditCardMonitor.tsx')
  assert.equal(/color:\s*utilizationTone\(/.test(src), false)
})

// LED-163: the "Not synced yet" marker is a pending state, so it takes the
// warning ink, not the accent (--primary). Checked as a marker block rather
// than added to STATUS_FILES above: both files also use --primary elsewhere
// for real links/accents that a whole-file ban would wrongly flag.
const PENDING_MARKER_FILES = [
  'components/transactions/TransactionRow.tsx',
  'components/dashboard/DashboardRecentTransactionsCard.tsx',
]

for (const file of PENDING_MARKER_FILES) {
  test(`${file}: "Not synced yet" marker is warning ink, not the accent`, () => {
    const lines = read(file).split('\n')
    const idx = lines.findIndex((line) => line.includes('Not synced yet'))
    assert.notEqual(idx, -1, 'marker text not found')
    const markerBlock = lines.slice(Math.max(0, idx - 1), idx + 1).join('\n')
    assert.equal(/text-primary\b/.test(markerBlock), false)
    assert.equal(/text-warning\b/.test(markerBlock), true)
  })
}
