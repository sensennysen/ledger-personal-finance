import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  WINDOW_STEP,
  signedAmount,
  groupByDay,
  sliceGroups,
  nextRowCount,
  dayLabel,
  sortByDate,
  sumByCurrency,
  dateSpan,
} from '../src/lib/transactionWindow.ts'

const tx = (overrides) => ({
  date: '2026-09-17',
  type: 'expense',
  amount: 10,
  currency: 'USD',
  exchange_rate: 1,
  to_account_id: null,
  ...overrides,
})

test('on Activity, income is positive, expense negative and transfers net to zero', () => {
  assert.equal(signedAmount(tx({ type: 'income', amount: 50 })), 50)
  assert.equal(signedAmount(tx({ type: 'expense', amount: 20 })), -20)
  assert.equal(signedAmount(tx({ type: 'transfer', amount: 500, to_account_id: 'b' })), 0)
})

test('inside an account, money arriving is positive at the exchange rate and leaving is negative', () => {
  assert.equal(signedAmount(tx({ type: 'transfer', amount: 100, to_account_id: 'acc', exchange_rate: 56 }), 'acc'), 5600)
  assert.equal(signedAmount(tx({ type: 'expense', amount: 30, to_account_id: 'acc' }), 'acc'), 30)
  assert.equal(signedAmount(tx({ type: 'transfer', amount: 500, to_account_id: 'other' }), 'acc'), -500)
  assert.equal(signedAmount(tx({ type: 'expense', amount: 9.4 }), 'acc'), -9.4)
  assert.equal(signedAmount(tx({ type: 'income', amount: 3200 }), 'acc'), 3200)
})

test('groups newest day first, keeps order within a day and nets per currency', () => {
  const rows = [
    tx({ date: '2026-09-16', amount: 5, id: 'a' }),
    tx({ date: '2026-09-17', amount: 86.4, id: 'b' }),
    tx({ date: '2026-09-17', type: 'income', amount: 200, currency: 'PHP', id: 'c' }),
    tx({ date: '2026-09-17', amount: 14, id: 'd' }),
  ]
  const groups = groupByDay(rows)
  assert.deepEqual(groups.map((g) => g.date), ['2026-09-17', '2026-09-16'])
  assert.deepEqual(groups[0].items.map((t) => t.id), ['b', 'c', 'd'])
  assert.equal(groups[0].count, 3)
  assert.equal(groups[0].net.USD, -100.4)
  assert.equal(groups[0].net.PHP, 200)
  assert.deepEqual(groups[1].net, { USD: -5 })
})

test('a day cut by the window keeps its whole-day count and net', () => {
  const rows = [
    tx({ date: '2026-09-17', amount: 1 }),
    tx({ date: '2026-09-16', amount: 2 }),
    tx({ date: '2026-09-16', amount: 3 }),
    tx({ date: '2026-09-16', amount: 4 }),
  ]
  const sliced = sliceGroups(groupByDay(rows), 2)
  assert.equal(sliced.length, 2)
  assert.equal(sliced[1].items.length, 1)
  assert.equal(sliced[1].count, 3)
  assert.equal(sliced[1].net.USD, -9)
})

test('2,000 rows on one account render one window step at a time', () => {
  const rows = Array.from({ length: 2000 }, (_, i) =>
    tx({ date: `2026-${String(12 - Math.floor(i / 200)).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}` }),
  )
  const groups = groupByDay(rows)
  const rendered = (count) => sliceGroups(groups, count).reduce((n, g) => n + g.items.length, 0)
  assert.equal(rendered(WINDOW_STEP.desktop), 60)
  assert.equal(rendered(nextRowCount(WINDOW_STEP.desktop, WINDOW_STEP.desktop, 2000)), 120)
  assert.equal(rendered(WINDOW_STEP.mobile), 30)
  assert.equal(rendered(5000), 2000)
})

test('the window never grows past the total', () => {
  assert.equal(nextRowCount(60, 60, 100), 100)
  assert.equal(nextRowCount(100, 60, 100), 100)
})

test('day labels name today and yesterday, across a month boundary', () => {
  const format = { short: (d) => `short:${d}`, full: (d) => `full:${d}` }
  assert.equal(dayLabel('2026-09-17', '2026-09-17', format), 'Today · short:2026-09-17')
  assert.equal(dayLabel('2026-09-16', '2026-09-17', format), 'Yesterday · short:2026-09-16')
  assert.equal(dayLabel('2026-08-31', '2026-09-01', format), 'Yesterday · short:2026-08-31')
  assert.equal(dayLabel('2026-09-10', '2026-09-17', format), 'full:2026-09-10')
})

test('sorts by date either way and keeps the incoming order within a day', () => {
  const rows = [
    tx({ date: '2026-09-16', id: 'a' }),
    tx({ date: '2026-09-17', id: 'b' }),
    tx({ date: '2026-09-16', id: 'c' }),
  ]
  assert.deepEqual(sortByDate(rows, 'newest').map((t) => t.id), ['b', 'a', 'c'])
  assert.deepEqual(sortByDate(rows, 'oldest').map((t) => t.id), ['a', 'c', 'b'])
  assert.deepEqual(rows.map((t) => t.id), ['a', 'b', 'c'])
})

test('oldest-first groups put the earliest day first', () => {
  const rows = [tx({ date: '2026-09-17' }), tx({ date: '2026-09-15' }), tx({ date: '2026-09-16' })]
  assert.deepEqual(groupByDay(rows, undefined, 'oldest').map((g) => g.date), ['2026-09-15', '2026-09-16', '2026-09-17'])
})

test('the match sum is per currency and signed like the rows', () => {
  const rows = [
    tx({ amount: 86.4 }),
    tx({ type: 'income', amount: 200, currency: 'PHP' }),
    tx({ type: 'transfer', amount: 500, to_account_id: 'b' }),
    tx({ amount: 13.6 }),
  ]
  assert.deepEqual(sumByCurrency(rows), { USD: -100, PHP: 200 })
  assert.deepEqual(sumByCurrency([]), {})
})

test('inside an account the match sum counts transfers in and out', () => {
  const rows = [
    tx({ type: 'transfer', amount: 100, to_account_id: 'acc', exchange_rate: 2 }),
    tx({ type: 'transfer', amount: 50, to_account_id: 'other' }),
    tx({ amount: 30 }),
  ]
  assert.deepEqual(sumByCurrency(rows, 'acc'), { USD: 120 })
})

test('the date span covers the earliest and latest rows, or is null when empty', () => {
  const rows = [tx({ date: '2026-03-02' }), tx({ date: '2025-09-14' }), tx({ date: '2026-09-17' })]
  assert.deepEqual(dateSpan(rows), { start: '2025-09-14', end: '2026-09-17' })
  assert.equal(dateSpan([]), null)
})
