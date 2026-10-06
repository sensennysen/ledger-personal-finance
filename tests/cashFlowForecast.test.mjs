import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCashFlowForecast } from '../src/lib/cashFlowForecast.ts'

// Base PHP. 1 USD = 56 PHP, 1 EUR = 60 PHP (rates are quoted per unit of the base).
const table = { base: 'PHP', rates: { USD: 1 / 56, EUR: 1 / 60 }, overrides: {}, asOf: '2026-10-01', fetchedAt: '2026-10-01T08:00:00' }
const cycleStart = new Date('2026-10-01T00:00:00')
const cycleEnd = new Date('2026-10-31T00:00:00')

const tx = (o) => ({
  type: 'expense', amount: 100, currency: 'PHP', exchange_rate: 1, date: '2026-09-05',
  recurrence_interval: 'monthly', recurrence_end_date: null, ...o,
})

const forecast = (series, t = table) =>
  buildCashFlowForecast({ series, cycleStart, cycleEnd, floor: cycleStart, currentBalance: 10000, baseCurrency: 'PHP', table: t })

test('USD income and EUR expenses convert into the PHP balance', () => {
  const result = forecast([
    tx({ type: 'income', amount: 1000, currency: 'USD', description: 'Salary' }),
    tx({ amount: 50, currency: 'EUR', recurrence_interval: 'weekly', date: '2026-09-29' }),
  ])
  // Salary: 1 × 1000 USD × 56 = 56,000. EUR: Oct 6, 13, 20, 27 = 4 × 50 × 60 = 12,000.
  assert.equal(Math.round(result.projectedIncome), 56000)
  assert.equal(Math.round(result.projectedExpenses), 12000)
  assert.equal(Math.round(result.projectedBalance), 10000 + 56000 - 12000)
  assert.deepEqual(result.excludedCurrencies, [])
  assert.deepEqual(result.forecastItems.map((i) => i.occurrences), [1, 4])
})

test('same-currency rows count as they are', () => {
  const result = forecast([tx({ amount: 250 })], null)
  assert.equal(result.projectedExpenses, 250)
  assert.equal(result.forecastItems[0].converted, 250)
})

test('a currency with no rate is left out and named, not counted one to one', () => {
  const result = forecast([tx({ amount: 900, currency: 'JPY' }), tx({ amount: 200 })])
  assert.equal(result.projectedExpenses, 200)
  assert.equal(result.projectedBalance, 9800)
  assert.deepEqual(result.excludedCurrencies, ['JPY'])
  const jpy = result.forecastItems.find((i) => i.tx.currency === 'JPY')
  assert.equal(jpy.converted, null)
  assert.equal(jpy.total, 900)
})

test('a recorded rate of 1 is not a rate', () => {
  const result = forecast([tx({ amount: 10, currency: 'USD', exchange_rate: 1 })], null)
  assert.deepEqual(result.excludedCurrencies, ['USD'])
  assert.equal(result.projectedExpenses, 0)
})

test('a recorded rate on the row wins over the table', () => {
  const result = forecast([tx({ amount: 10, currency: 'USD', exchange_rate: 50 })])
  assert.equal(result.projectedExpenses, 500)
})

test('items sort by converted amount, unrated items last', () => {
  const result = forecast([
    tx({ amount: 5000, currency: 'JPY' }),
    tx({ amount: 100 }),
    tx({ amount: 10, currency: 'USD' }),
  ])
  assert.deepEqual(result.forecastItems.map((i) => i.tx.currency), ['USD', 'PHP', 'JPY'])
})
