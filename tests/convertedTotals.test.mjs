import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sumConverted } from '../src/lib/convertedTotals.ts'

const row = (o) => ({ amount: 100, currency: 'PHP', exchange_rate: null, ...o })

// 1 USD = 56 PHP.
const table = { base: 'PHP', rates: { USD: 1 / 56 }, overrides: {}, asOf: '2026-09-25', fetchedAt: '2026-09-26T08:00:00' }

test('same currency counts as-is', () => {
  assert.deepEqual(sumConverted([row({})], 'PHP', null), { total: 100, excludedCurrencies: [] })
})

test('a rate recorded on the row converts it', () => {
  assert.deepEqual(sumConverted([row({ currency: 'USD', amount: 10, exchange_rate: 56 })], 'PHP', null), {
    total: 560,
    excludedCurrencies: [],
  })
})

test('with no row rate the table converts, and an override rate on the row still wins over it', () => {
  const result = sumConverted(
    [row({ currency: 'USD', amount: 10, exchange_rate: 1 }), row({ currency: 'USD', amount: 10, exchange_rate: 50 })],
    'PHP',
    table,
  )
  assert.ok(Math.abs(result.total - 1060) < 1e-9)
  assert.deepEqual(result.excludedCurrencies, [])
})

test('a currency the table lacks is left out of the total and named, beside one it converts', () => {
  const result = sumConverted([row({}), row({ currency: 'USD', amount: 56, exchange_rate: 1 }), row({ currency: 'EUR', exchange_rate: 1 })], 'PHP', table)
  assert.ok(Math.abs(result.total - 3236) < 1e-9)
  assert.deepEqual(result.excludedCurrencies, ['EUR'])
})

test('a currency with no rate at all (no table) is left out, never counted at 1', () => {
  assert.deepEqual(sumConverted([row({}), row({ currency: 'USD', exchange_rate: 1 })], 'PHP', null), {
    total: 100,
    excludedCurrencies: ['USD'],
  })
})

test('a single-currency total is unaffected by a missing table', () => {
  assert.deepEqual(sumConverted([row({}), row({ amount: 50 })], 'PHP', null), { total: 150, excludedCurrencies: [] })
})

test('empty input sums to zero', () => {
  assert.deepEqual(sumConverted([], 'PHP', null), { total: 0, excludedCurrencies: [] })
})
