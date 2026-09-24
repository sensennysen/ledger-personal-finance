import { test } from 'node:test'
import assert from 'node:assert/strict'
import { entryBudgetImpact } from '../src/lib/budgetImpact.ts'

const range = { start: '2026-09-01', end: '2026-09-30' }
const tx = { type: 'expense', category_id: 'groceries', amount: 86.4, date: '2026-09-09', currency: 'USD', exchange_rate: null }
const budget = { category_id: 'groceries', currency: 'USD', amount: 600, spent: 412, effective_amount: 600 }

test('an expense shows its share of the category budget', () => {
  assert.deepEqual(entryBudgetImpact(tx, budget, range), { entry: 86.4, spent: 412, allowance: 600, currency: 'USD' })
})

test('rollover counts toward the allowance', () => {
  assert.equal(entryBudgetImpact(tx, { ...budget, effective_amount: 750 }, range).allowance, 750)
})

test('income, transfers and uncategorised entries have no budget impact', () => {
  assert.equal(entryBudgetImpact({ ...tx, type: 'income' }, budget, range), null)
  assert.equal(entryBudgetImpact({ ...tx, type: 'transfer' }, budget, range), null)
  assert.equal(entryBudgetImpact({ ...tx, category_id: null }, budget, range), null)
})

test('no budget, another category, or outside the budget range shows nothing', () => {
  assert.equal(entryBudgetImpact(tx, null, range), null)
  assert.equal(entryBudgetImpact(tx, { ...budget, category_id: 'dining' }, range), null)
  assert.equal(entryBudgetImpact({ ...tx, date: '2026-10-01' }, budget, range), null)
})

test('converts another currency the way budget spend does', () => {
  const r = entryBudgetImpact({ ...tx, currency: 'PHP', amount: 1000, exchange_rate: 0.018 }, budget, range)
  assert.equal(r.entry, 18)
})

test('an unrated foreign currency is not guessed at', () => {
  assert.equal(entryBudgetImpact({ ...tx, currency: 'PHP' }, budget, range), null)
})

test('a zero allowance has no share to show', () => {
  assert.equal(entryBudgetImpact(tx, { ...budget, amount: 0, effective_amount: 0 }, range), null)
})

test('spent never reads lower than the entry itself (stale cache)', () => {
  assert.equal(entryBudgetImpact(tx, { ...budget, spent: 0 }, range).spent, 86.4)
})
