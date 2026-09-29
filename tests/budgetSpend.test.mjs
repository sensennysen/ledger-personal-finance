import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sumBudgetSpend } from '../src/lib/budgetSpend.ts'

const b = { category_id: 'c1', currency: 'PHP' }
const tx = (o) => ({ category_id: 'c1', amount: 100, date: '2026-09-10', currency: 'PHP', exchange_rate: null, ...o })
const sum = (txs) => sumBudgetSpend(txs, b, '2026-09-01', '2026-09-30')

test('same currency counts as-is', () => {
  assert.deepEqual(sum([tx({})]), { spent: 100, unrated: [] })
})

test('rated foreign currency is converted', () => {
  assert.deepEqual(sum([tx({ currency: 'USD', amount: 10, exchange_rate: 56 })]), { spent: 560, unrated: [] })
})

test('unrated foreign currency is excluded and named', () => {
  assert.deepEqual(sum([tx({}), tx({ currency: 'USD' }), tx({ currency: 'EUR' }), tx({ currency: 'USD' })]), {
    spent: 100,
    unrated: ['EUR', 'USD'],
  })
})

test('other categories and out-of-range dates are ignored', () => {
  assert.deepEqual(sum([tx({ category_id: 'c2', currency: 'USD' }), tx({ date: '2026-08-31', currency: 'USD' })]), {
    spent: 0,
    unrated: [],
  })
})

// ── With exchange rates (LED-136) ───────────────────────────
import { spendByCategory } from '../src/lib/budgetSuggestions.ts'

// 1 USD = 56 PHP.
const table = { base: 'PHP', rates: { USD: 1 / 56 }, overrides: {}, asOf: '2026-09-25', fetchedAt: '2026-09-26T08:00:00' }
const withRates = (txs) => sumBudgetSpend(txs, b, '2026-09-01', '2026-09-30', table)

test('a foreign expense with the untouched rate of 1 converts with the table instead of counting one to one', () => {
  const result = withRates([tx({ currency: 'USD', amount: 10, exchange_rate: 1 })])
  assert.ok(Math.abs(result.spent - 560) < 1e-9)
  assert.deepEqual(result.unrated, [])
})

test('a rate recorded on the row still wins over the table', () => {
  assert.deepEqual(withRates([tx({ currency: 'USD', amount: 10, exchange_rate: 50 })]), { spent: 500, unrated: [] })
})

test('a currency the table lacks stays out and named, beside one it converts', () => {
  const result = withRates([tx({ currency: 'USD', amount: 56, exchange_rate: 1 }), tx({ currency: 'EUR', exchange_rate: 1 })])
  assert.ok(Math.abs(result.spent - 3136) < 1e-9)
  assert.deepEqual(result.unrated, ['EUR'])
})

test('with no table a foreign expense at 1 is no longer counted one to one', () => {
  assert.deepEqual(sum([tx({ currency: 'USD', exchange_rate: 1 })]), { spent: 0, unrated: ['USD'] })
})

test('last-cycle suggestions convert with the table too', () => {
  const rows = spendByCategory(
    [tx({ currency: 'USD', amount: 10, exchange_rate: 1 }), tx({ currency: 'EUR', exchange_rate: 1 })],
    '2026-09-01', '2026-09-30', 'PHP', table,
  )
  assert.equal(rows.length, 1)
  assert.ok(Math.abs(rows[0].spent - 560) < 1e-9)
  assert.deepEqual(rows[0].unrated, ['EUR'])
})
