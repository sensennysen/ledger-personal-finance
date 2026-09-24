import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPayeeMemory, suggestCategory } from '../src/lib/importCategories.ts'

const categories = new Map(
  [
    { id: 'groceries', type: 'expense' },
    { id: 'transport', type: 'expense' },
    { id: 'salary', type: 'income' },
    { id: 'gifts', type: 'both' },
  ].map((category) => [category.id, category]),
)

const tx = (description, category_id, date = '2026-08-01', type = 'expense') => ({ description, category_id, type, date })

test('a payee gets the category it was most often filed under', () => {
  const memory = buildPayeeMemory([
    tx('GRAB *RIDE 4471', 'transport'),
    tx('Grab Ride 8812', 'transport'),
    tx('GRAB RIDE', 'groceries', '2026-09-01'),
  ])
  assert.deepEqual(suggestCategory({ description: 'GRAB *RIDE 1190', type: 'expense' }, [], memory, categories), {
    categoryId: 'transport',
    source: 'history',
  })
})

test('a tie goes to the most recently used category', () => {
  const memory = buildPayeeMemory([tx('SM SUPERMARKET', 'gifts', '2026-07-01'), tx('SM SUPERMARKET', 'groceries', '2026-09-01')])
  assert.equal(suggestCategory({ description: 'SM SUPERMARKET', type: 'expense' }, [], memory, categories).categoryId, 'groceries')
})

test('history is kept per type, so a refund does not borrow the purchase category', () => {
  const memory = buildPayeeMemory([tx('LAZADA', 'groceries')])
  assert.equal(suggestCategory({ description: 'LAZADA', type: 'income' }, [], memory, categories), null)
})

test('a rule wins over history, highest priority first', () => {
  const memory = buildPayeeMemory([tx('SHELL KATIPUNAN', 'groceries')])
  const rules = [
    { keyword: 'shell', category_id: 'transport', priority: 1 },
    { keyword: 'katipunan', category_id: 'gifts', priority: 3 },
  ]
  assert.deepEqual(suggestCategory({ description: 'SHELL KATIPUNAN', type: 'expense' }, rules, memory, categories), {
    categoryId: 'gifts',
    source: 'rule',
  })
})

test("a category that doesn't fit the row's type, or no longer exists, is never suggested", () => {
  const rules = [{ keyword: 'payroll', category_id: 'groceries', priority: 9 }]
  const memory = buildPayeeMemory([tx('PAYROLL ACME', 'salary', '2026-08-01', 'income'), tx('NETFLIX', 'deleted')])
  assert.equal(suggestCategory({ description: 'PAYROLL ACME', type: 'income' }, rules, memory, categories).categoryId, 'salary')
  assert.equal(suggestCategory({ description: 'NETFLIX', type: 'expense' }, [], memory, categories), null)
})

test('rows with no type or no description get nothing', () => {
  const memory = buildPayeeMemory([tx('', 'groceries'), tx(null, 'groceries')])
  assert.equal(suggestCategory({ description: '', type: 'expense' }, [], memory, categories), null)
  assert.equal(suggestCategory({ description: 'GRAB', type: null }, [], memory, categories), null)
})
