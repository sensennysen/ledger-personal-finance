import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCategoryUsage,
  shareOf,
  unusedCategoryIds,
  subcategoryCounts,
  deleteCostSentence,
} from '../src/lib/categoryUsage.ts'

const range = { start: '2026-09-01', end: '2026-09-30' }
const tx = (category_id, amount, date, extra = {}) => ({
  category_id,
  subcategory_id: null,
  type: 'expense',
  amount,
  currency: 'PHP',
  exchange_rate: null,
  date,
  ...extra,
})

const rows = [
  tx('groc', 684.2, '2026-09-03', { subcategory_id: 'weekly' }),
  tx('groc', 212, '2026-09-10', { subcategory_id: 'bulk' }),
  tx('groc', 116.2, '2026-09-20'),
  tx('groc', 50, '2026-08-20'),
  tx('dine', 742.3, '2026-09-04'),
  tx('sal', 6400, '2026-09-08', { type: 'income' }),
  tx('sal', 30, '2026-09-09'),
  tx('both', 500, '2026-09-11', { type: 'transfer' }),
]

test('spend counts only this cycle, by side, and the count is all time', () => {
  const usage = buildCategoryUsage(rows, range, 'PHP')
  const groc = usage.byCategory.get('groc')
  assert.equal(Math.round(groc.spend.expense * 100) / 100, 1012.4)
  assert.equal(groc.txCount, 4)
})

test('a both-type category keeps expense and income apart', () => {
  const usage = buildCategoryUsage(rows, range, 'PHP')
  const sal = usage.byCategory.get('sal')
  assert.equal(sal.spend.income, 6400)
  assert.equal(sal.spend.expense, 30)
  assert.equal(sal.txCount, 2)
})

test('transfers count as transactions but never as spend', () => {
  const usage = buildCategoryUsage(rows, range, 'PHP')
  const both = usage.byCategory.get('both')
  assert.equal(both.txCount, 1)
  assert.deepEqual(both.spend, { expense: 0, income: 0 })
  assert.equal(Math.round(usage.totals.expense * 100) / 100, 1784.7)
})

test('share is a whole percent of the side total and null when there is nothing to share', () => {
  const usage = buildCategoryUsage(rows, range, 'PHP')
  const dine = usage.byCategory.get('dine').spend.expense
  assert.equal(shareOf(dine, usage.totals.expense), 42)
  assert.equal(shareOf(5, 0), null)
  const groc = usage.byCategory.get('groc').spend.expense
  const shares = ['groc', 'dine', 'sal'].map((id) =>
    shareOf(usage.byCategory.get(id).spend.expense, usage.totals.expense),
  )
  assert.ok(shares.reduce((a, b) => a + b, 0) >= 99 && shares.reduce((a, b) => a + b, 0) <= 101)
  assert.ok(groc > dine)
})

test('per-subcategory spend is kept for the pane', () => {
  const usage = buildCategoryUsage(rows, range, 'PHP')
  const subs = usage.byCategory.get('groc').bySubcategory
  assert.equal(subs.get('weekly').expense, 684.2)
  assert.equal(subs.get('bulk').expense, 212)
  assert.equal(subs.size, 2)
})

test('other currencies convert with their rate; without one they are left out and reported', () => {
  const usage = buildCategoryUsage(
    [
      tx('a', 10, '2026-09-05', { currency: 'USD', exchange_rate: 50 }),
      tx('a', 99, '2026-09-06', { currency: 'EUR' }),
    ],
    range,
    'PHP',
  )
  assert.equal(usage.byCategory.get('a').spend.expense, 500)
  assert.equal(usage.byCategory.get('a').txCount, 1 + 1)
  assert.deepEqual(usage.unrated, ['EUR'])
})

test('uncategorised transactions are ignored', () => {
  const usage = buildCategoryUsage([tx(null, 10, '2026-09-05')], range, 'PHP')
  assert.equal(usage.byCategory.size, 0)
  assert.equal(usage.totals.expense, 0)
})

test('unusedCategoryIds lists categories with no transactions at all', () => {
  const usage = buildCategoryUsage(rows, range, 'PHP')
  assert.deepEqual(unusedCategoryIds(['groc', 'gifts', 'dine', 'old'], usage), ['gifts', 'old'])
})

test('a category with only old transactions is used, not unused', () => {
  const usage = buildCategoryUsage([tx('x', 5, '2025-01-01')], range, 'PHP')
  assert.deepEqual(unusedCategoryIds(['x'], usage), [])
  assert.deepEqual(usage.byCategory.get('x').spend, { expense: 0, income: 0 })
})

test('subcategoryCounts groups by category', () => {
  const counts = subcategoryCounts([{ category_id: 'a' }, { category_id: 'a' }, { category_id: 'b' }])
  assert.equal(counts.get('a'), 2)
  assert.equal(counts.get('b'), 1)
  assert.equal(counts.get('c'), undefined)
})

test('the delete sentence states the number, and gives none when it is unknown', () => {
  assert.equal(
    deleteCostSentence('Groceries', 38, 4),
    'This will delete "Groceries" and its 4 subcategories. 38 transactions will become uncategorized.',
  )
  assert.equal(
    deleteCostSentence('Gifts', 1, 1),
    'This will delete "Gifts" and its 1 subcategory. 1 transaction will become uncategorized.',
  )
  assert.equal(deleteCostSentence('Old', 0, 0), 'This will delete "Old". No transactions use it.')
  const unknown = deleteCostSentence('Groceries', null, null)
  assert.equal(/\d/.test(unknown), false)
  assert.match(unknown, /Transactions using it will become uncategorized/)
})
