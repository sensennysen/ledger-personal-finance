import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  WINDOW_STEP,
  signedAmount,
  amountDisplay,
  effectiveDensity,
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

test('amountDisplay follows signedAmount and prints the U+2212 minus', () => {
  assert.deepEqual(amountDisplay(tx({ type: 'expense', amount: 10 })), { sign: '−', value: 10, currency: 'USD' })
  assert.deepEqual(amountDisplay(tx({ type: 'income', amount: 10 })), { sign: '+', value: 10, currency: 'USD' })
})

test('amountDisplay shows a transfer without a context unsigned, at its own amount', () => {
  assert.deepEqual(amountDisplay(tx({ type: 'transfer', amount: 25, to_account_id: 'b' })), { sign: '', value: 25, currency: 'USD' })
})

test('amountDisplay inside an account: outgoing transfer unsigned, incoming at the rate', () => {
  assert.deepEqual(
    amountDisplay(tx({ type: 'transfer', amount: 25, account_id: 'a', to_account_id: 'b' }), 'a'),
    { sign: '', value: 25, currency: 'USD' },
  )
  assert.deepEqual(
    amountDisplay(tx({ type: 'transfer', amount: 10, exchange_rate: 1.5, to_account_id: 'b' }), 'b'),
    { sign: '+', value: 15, currency: 'USD' },
  )
})

test('amountDisplay: a loan repayment into the account is money in, an expense out of it is money out', () => {
  assert.deepEqual(amountDisplay(tx({ type: 'expense', amount: 40, to_account_id: 'loan' }), 'loan'), { sign: '+', value: 40, currency: 'USD' })
  assert.deepEqual(amountDisplay(tx({ type: 'expense', amount: 40, to_account_id: 'loan' }), 'checking'), { sign: '−', value: 40, currency: 'USD' })
})

test('the value amountDisplay prints is the value signedAmount nets', () => {
  for (const [type, to] of [['income', null], ['expense', null], ['transfer', 'b'], ['expense', 'b']]) {
    for (const ctx of [undefined, 'a', 'b']) {
      const t = tx({ type, amount: 12.5, exchange_rate: 2, to_account_id: to })
      const { sign, value } = amountDisplay(t, ctx)
      const signed = signedAmount(t, ctx)
      if (sign === '+') assert.equal(value, signed)
      if (sign === '−') assert.equal(-value, signed)
    }
  }
})

test('Compact density is ignored on a phone and kept elsewhere', () => {
  assert.equal(effectiveDensity('compact', true), 'comfortable')
  assert.equal(effectiveDensity('compact', false), 'compact')
  assert.equal(effectiveDensity('comfortable', false), 'comfortable')
})

test('an incoming cross-currency transfer is labelled and netted in the destination currency (LED-149)', () => {
  const t = tx({ type: 'transfer', amount: 100, currency: 'USD', exchange_rate: 56, to_account_id: 'php', to_account: { currency: 'PHP' } })
  assert.deepEqual(amountDisplay(t, 'php'), { sign: '+', value: 5600, currency: 'PHP' })
  assert.deepEqual(sumByCurrency([t], 'php'), { PHP: 5600 })
  assert.equal(groupByDay([t], 'php')[0].net.PHP, 5600)
  // From the source account it is still money out, in the source currency.
  assert.deepEqual(amountDisplay(t, 'usd'), { sign: '', value: 100, currency: 'USD' })
  assert.deepEqual(sumByCurrency([t], 'usd'), { USD: -100 })
})
