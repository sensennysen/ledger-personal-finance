import { test } from 'node:test'
import assert from 'node:assert/strict'
import { goalContributionTotal } from '../src/lib/goalContributions.ts'

// 1 USD = 56 PHP.
const table = { base: 'PHP', rates: { USD: 1 / 56 }, overrides: {}, asOf: '2026-10-01', fetchedAt: '2026-10-01T08:00:00' }
const row = (o) => ({ type: 'income', amount: 100, currency: 'PHP', exchange_rate: 1, ...o })

test('USD and PHP linked to a PHP goal add up at the known rate', () => {
  const result = goalContributionTotal([row({ amount: 10, currency: 'USD' }), row({ amount: 500 })], 'PHP', table)
  assert.equal(result.total, 560 + 500)
  assert.deepEqual(result.excludedCurrencies, [])
})

test('an expense takes away, converted too', () => {
  const result = goalContributionTotal([row({ amount: 1000 }), row({ type: 'expense', amount: 5, currency: 'USD' })], 'PHP', table)
  assert.equal(result.total, 1000 - 280)
})

test('a missing rate is named, not counted one to one', () => {
  const result = goalContributionTotal([row({ amount: 10, currency: 'EUR' }), row({ amount: 200 })], 'PHP', table)
  assert.equal(result.total, 200)
  assert.deepEqual(result.excludedCurrencies, ['EUR'])
})

test('a recorded rate on the row is honoured', () => {
  assert.equal(goalContributionTotal([row({ amount: 10, currency: 'USD', exchange_rate: 50 })], 'PHP', null).total, 500)
})
