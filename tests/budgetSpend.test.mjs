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
