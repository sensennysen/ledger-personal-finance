import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shiftMonthKey, monthKeyOf, buildMonthNets, monthJumpTarget } from '../src/lib/monthJump.ts'
import { groupByDay } from '../src/lib/transactionWindow.ts'

const tx = (overrides) => ({
  date: '2026-09-17',
  type: 'expense',
  amount: 10,
  currency: 'USD',
  exchange_rate: 1,
  to_account_id: null,
  ...overrides,
})

test('month keys shift across year boundaries', () => {
  assert.equal(shiftMonthKey('2026-01', -1), '2025-12')
  assert.equal(shiftMonthKey('2025-12', 1), '2026-01')
  assert.equal(shiftMonthKey('2026-09', -24), '2024-09')
})

test('a date belongs to the cycle whose range contains it', () => {
  assert.equal(monthKeyOf('2026-09-01', 1), '2026-09')
  assert.equal(monthKeyOf('2026-09-30', 1), '2026-09')
  // Start day 25: Sep 25 opens the "2026-09" cycle, Sep 24 still closes "2026-08".
  assert.equal(monthKeyOf('2026-09-25', 25), '2026-09')
  assert.equal(monthKeyOf('2026-09-24', 25), '2026-08')
  assert.equal(monthKeyOf('2026-01-10', 25), '2025-12')
})

test('months run newest first from the current cycle to the oldest transaction, gaps kept', () => {
  const months = buildMonthNets(
    [tx({ date: '2026-09-02', type: 'income', amount: 100 }), tx({ date: '2026-06-10', amount: 40 })],
    { startDay: 1, currentKey: '2026-09' },
  )
  assert.deepEqual(months.map((m) => m.key), ['2026-09', '2026-08', '2026-07', '2026-06'])
  assert.deepEqual(months[0], { key: '2026-09', count: 1, net: { USD: 100 } })
  assert.deepEqual(months[1], { key: '2026-08', count: 0, net: {} })
  assert.deepEqual(months[3].net, { USD: -40 })
})

test('an empty current cycle still leads the list, and a future-dated row extends it', () => {
  const months = buildMonthNets([tx({ date: '2026-07-01' }), tx({ date: '2026-10-03' })], {
    startDay: 1,
    currentKey: '2026-09',
  })
  assert.deepEqual(months.map((m) => m.key), ['2026-10', '2026-09', '2026-08', '2026-07'])
})

test('no transactions means no months', () => {
  assert.deepEqual(buildMonthNets([], { startDay: 1, currentKey: '2026-09' }), [])
})

test('nets stay per currency; transfers net to zero on Activity', () => {
  const [month] = buildMonthNets(
    [
      tx({ amount: 20 }),
      tx({ amount: 5, currency: 'EUR' }),
      tx({ type: 'transfer', amount: 500, to_account_id: 'b' }),
    ],
    { startDay: 1, currentKey: '2026-09' },
  )
  assert.deepEqual(month.net, { USD: -20, EUR: -5 })
  assert.equal(month.count, 3)
})

test('inside an account, an incoming transfer counts as positive', () => {
  const [month] = buildMonthNets(
    [tx({ type: 'transfer', amount: 300, to_account_id: 'acc' }), tx({ amount: 50 })],
    { startDay: 1, currentKey: '2026-09', contextAccountId: 'acc' },
  )
  assert.deepEqual(month.net, { USD: 250 })
})

const history = [
  tx({ date: '2026-09-10' }),
  tx({ date: '2026-09-10' }),
  tx({ date: '2026-08-20' }),
  tx({ date: '2026-08-05' }),
  tx({ date: '2026-07-01' }),
]

test('jump target, newest first: the latest day of the month and the rows needed to show it', () => {
  const groups = groupByDay(history, undefined, 'newest')
  assert.deepEqual(monthJumpTarget(groups, { start: '2026-08-01', end: '2026-08-31' }), {
    date: '2026-08-20',
    rowsThrough: 3,
  })
})

test('jump target, oldest first: the earliest day of the month', () => {
  const groups = groupByDay(history, undefined, 'oldest')
  assert.deepEqual(monthJumpTarget(groups, { start: '2026-08-01', end: '2026-08-31' }), {
    date: '2026-08-05',
    rowsThrough: 2,
  })
})

test('jump target is null for a month with no rows', () => {
  const groups = groupByDay(history)
  assert.equal(monthJumpTarget(groups, { start: '2026-06-01', end: '2026-06-30' }), null)
})
