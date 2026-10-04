import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  previousCycleKey,
  cycleMonthLabel,
  summarizeRange,
  netWorthEffect,
  convertedNetWorthEffect,
  compareToPrevious,
  formatComparison,
  likeForLikeWindows,
  comparisonLabel,
} from '../src/lib/periodCompare.ts'

// 1 USD = 56 PHP.
const table = { base: 'PHP', rates: { USD: 1 / 56 }, overrides: {}, asOf: '2026-09-25', fetchedAt: '2026-09-26T08:00:00' }

test('previous cycle key steps back a month, across years', () => {
  assert.equal(previousCycleKey('2026-09'), '2026-08')
  assert.equal(previousCycleKey('2026-01'), '2025-12')
})

test('cycle month label is the short month name', () => {
  assert.equal(cycleMonthLabel('2026-08'), 'Aug')
})

test('summarizeRange counts income and expenses inside the range only, converted', () => {
  const txs = [
    { date: '2026-08-31', type: 'income', amount: 999, currency: 'PHP' },
    { date: '2026-09-01', type: 'income', amount: 100, currency: 'PHP' },
    { date: '2026-09-10', type: 'expense', amount: 40, currency: 'USD', exchange_rate: 2 },
    { date: '2026-09-15', type: 'transfer', amount: 500, currency: 'PHP' },
    { date: '2026-10-01', type: 'expense', amount: 999, currency: 'PHP' },
  ]
  assert.deepEqual(summarizeRange(txs, '2026-09-01', '2026-09-30', 'PHP'), {
    income: 100,
    expenses: 80,
    net: 20,
    excludedCurrencies: [],
  })
})

test('summarizeRange leaves out a currency with no rate and names it, never counting it at 1', () => {
  const txs = [
    { date: '2026-09-01', type: 'income', amount: 100, currency: 'PHP' },
    { date: '2026-09-10', type: 'expense', amount: 20, currency: 'EUR', exchange_rate: 1 },
  ]
  assert.deepEqual(summarizeRange(txs, '2026-09-01', '2026-09-30', 'PHP'), {
    income: 100,
    expenses: 0,
    net: 100,
    excludedCurrencies: ['EUR'],
  })
})

test('net worth effect: transfers cost only their fee, card payments nothing', () => {
  assert.equal(netWorthEffect({ date: '', type: 'income', amount: 50 }), 50)
  assert.equal(netWorthEffect({ date: '', type: 'expense', amount: 30 }), -30)
  assert.equal(netWorthEffect({ date: '', type: 'expense', amount: 30, to_account_id: 'card' }), 0)
  assert.equal(netWorthEffect({ date: '', type: 'transfer', amount: 500, transfer_fee: 15 }), -15)
  assert.equal(netWorthEffect({ date: '', type: 'transfer', amount: 500 }), 0)
})

test('convertedNetWorthEffect: same as netWorthEffect in the target currency', () => {
  const tx = { date: '', type: 'income', amount: 50, currency: 'PHP' }
  assert.equal(convertedNetWorthEffect(tx, 'PHP', null), 50)
  assert.equal(convertedNetWorthEffect({ ...tx, type: 'expense' }, 'PHP', null), -50)
  assert.equal(convertedNetWorthEffect({ ...tx, type: 'expense', to_account_id: 'card' }, 'PHP', null), 0)
  assert.equal(convertedNetWorthEffect({ ...tx, type: 'transfer', transfer_fee: 15 }, 'PHP', null), -15)
  assert.equal(convertedNetWorthEffect({ ...tx, type: 'transfer' }, 'PHP', null), 0)
})

test('convertedNetWorthEffect converts a foreign row with the table', () => {
  const tx = { date: '', type: 'income', amount: 10, currency: 'USD', exchange_rate: 1 }
  assert.equal(convertedNetWorthEffect(tx, 'PHP', table), 560)
  assert.equal(convertedNetWorthEffect({ ...tx, type: 'expense' }, 'PHP', table), -560)
  assert.equal(convertedNetWorthEffect({ ...tx, type: 'transfer', transfer_fee: 10 }, 'PHP', table), -560)
})

test('convertedNetWorthEffect leaves out a currency with no rate, never counting it at 1', () => {
  const tx = { date: '', type: 'income', amount: 10, currency: 'EUR', exchange_rate: 1 }
  assert.equal(convertedNetWorthEffect(tx, 'PHP', table), null)
  assert.equal(convertedNetWorthEffect({ ...tx, type: 'expense' }, 'PHP', table), null)
  assert.equal(convertedNetWorthEffect({ ...tx, type: 'transfer', transfer_fee: 10 }, 'PHP', table), null)
})

test('compareToPrevious rounds to one decimal and gives a direction', () => {
  assert.deepEqual(compareToPrevious(3812.65, 3410.2), { pct: 11.8, direction: 'up' })
  assert.deepEqual(compareToPrevious(90, 100), { pct: 10, direction: 'down' })
  assert.deepEqual(compareToPrevious(100.01, 100), { pct: 0, direction: 'flat' })
})

test('a negative previous period compares against its magnitude', () => {
  // Net went from a 200 deficit to a 100 surplus: up 150%.
  assert.deepEqual(compareToPrevious(100, -200), { pct: 150, direction: 'up' })
})

test('nothing to compare against gives no percentage', () => {
  assert.deepEqual(compareToPrevious(50, 0), { pct: null, direction: 'up' })
  assert.deepEqual(compareToPrevious(0, 0), { pct: null, direction: 'flat' })
})

test('formatComparison wording', () => {
  assert.equal(formatComparison({ pct: 11.8, direction: 'up' }, 'Aug'), '↑ 11.8% vs Aug')
  assert.equal(formatComparison({ pct: 4.2, direction: 'down' }, 'Aug'), '↓ 4.2% vs Aug')
  assert.equal(formatComparison({ pct: 0, direction: 'flat' }, 'Aug'), 'Same as Aug')
  assert.equal(formatComparison({ pct: null, direction: 'up' }, 'Aug'), 'Nothing in Aug to compare')
  assert.equal(formatComparison({ pct: null, direction: 'flat' }, 'Aug'), 'Same as Aug')
})

test('convertedNetWorthEffect: a transfer between two currencies moves net worth by what arrived less what left (LED-185)', () => {
  // 1 USD = 56 PHP; sending 10 USD that arrives as 500 PHP loses 60 PHP, plus a 2 USD fee.
  const transfer = {
    date: '2026-09-10', type: 'transfer', amount: 10, currency: 'USD', exchange_rate: 1,
    to_account_id: 'php', to_account: { currency: 'PHP' }, destination_amount: 500, transfer_fee: 2,
  }
  assert.ok(Math.abs(convertedNetWorthEffect(transfer, 'PHP', table) - (500 - 560 - 112)) < 1e-9)
  // Within one currency, or with no destination amount, it is still only the fee.
  assert.equal(convertedNetWorthEffect({ ...transfer, destination_amount: null, transfer_fee: null }, 'PHP', table), 0)
  // A side no rate converts makes the whole effect unknown, never counted at 1.
  assert.equal(convertedNetWorthEffect({ ...transfer, currency: 'EUR' }, 'PHP', table), null)
})

// LED-237: like-for-like windows.
const sep = { start: '2026-09-01', end: '2026-09-30' }
const aug = { start: '2026-08-01', end: '2026-08-31' }

test('an open cycle on day 4 compares day 1 to 4 of each', () => {
  const w = likeForLikeWindows(sep, aug, '2026-09-04')
  assert.deepEqual(w.current, { start: '2026-09-01', end: '2026-09-04' })
  assert.deepEqual(w.previous, { start: '2026-08-01', end: '2026-08-04' })
  assert.equal(w.partial, true)
  assert.equal(comparisonLabel('2026-08', w), 'Aug 1 – Aug 4')
})

test('day 1 compares one day with one day', () => {
  const w = likeForLikeWindows(sep, aug, '2026-09-01')
  assert.deepEqual(w.previous, { start: '2026-08-01', end: '2026-08-01' })
})

test('the last day of a 30-day cycle still cuts a 31-day previous one', () => {
  const w = likeForLikeWindows(sep, aug, '2026-09-30')
  assert.deepEqual(w.previous, { start: '2026-08-01', end: '2026-08-30' })
  assert.equal(w.partial, true)
})

test('a previous cycle shorter than N days is used whole', () => {
  const mar = { start: '2026-03-01', end: '2026-03-31' }
  const feb = { start: '2026-02-01', end: '2026-02-28' }
  const w = likeForLikeWindows(mar, feb, '2026-03-30')
  assert.deepEqual(w.previous, feb)
  assert.equal(w.partial, false)
  assert.equal(comparisonLabel('2026-02', w), 'Feb')
})

test('a closed cycle compares whole with whole', () => {
  const w = likeForLikeWindows(aug, { start: '2026-07-01', end: '2026-07-31' }, '2026-10-04')
  assert.deepEqual(w.current, aug)
  assert.deepEqual(w.previous, { start: '2026-07-01', end: '2026-07-31' })
  assert.equal(w.partial, false)
  assert.equal(comparisonLabel('2026-07', w), 'Jul')
})

test('a cycle starting on the 25th crosses the year', () => {
  const current = { start: '2026-12-25', end: '2027-01-24' }
  const previous = { start: '2026-11-25', end: '2026-12-24' }
  const w = likeForLikeWindows(current, previous, '2027-01-02')
  assert.deepEqual(w.current, { start: '2026-12-25', end: '2027-01-02' })
  assert.deepEqual(w.previous, { start: '2026-11-25', end: '2026-12-03' })
  assert.equal(comparisonLabel('2026-11', w), 'Nov 25 – Dec 3')
})
