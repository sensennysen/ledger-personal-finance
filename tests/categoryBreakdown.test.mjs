import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCategoryBreakdown,
  rollupBreakdown,
  previewOther,
  topCategories,
  PIE_MAX_CATEGORIES,
  RANKED_TOP,
  OTHER_PREVIEW,
} from '../src/lib/categoryBreakdown.ts'

const tx = (overrides) => ({
  type: 'expense',
  amount: 10,
  currency: 'PHP',
  exchange_rate: 1,
  category_id: 'c1',
  subcategory_id: null,
  subcategory: null,
  ...overrides,
})

const categories = (n) =>
  new Map(Array.from({ length: n }, (_, i) => [`c${i + 1}`, { name: `Cat ${i + 1}`, color: `#${i}` }]))

/** n categories with distinct amounts, largest first: c1 = n, c2 = n - 1, ... */
const spread = (n) => buildCategoryBreakdown(
  Array.from({ length: n }, (_, i) => tx({ category_id: `c${i + 1}`, amount: n - i })),
  categories(n),
  'PHP',
).rows

// 1 USD = 56 PHP.
const table = { base: 'PHP', rates: { USD: 1 / 56 }, overrides: {}, asOf: '2026-09-25', fetchedAt: '2026-09-26T08:00:00' }

test('expenses only, converted, largest first, uncategorized bucketed', () => {
  const { rows, excludedCurrencies } = buildCategoryBreakdown(
    [
      tx({ category_id: 'c1', currency: 'USD', amount: 10, exchange_rate: 2 }),
      tx({ category_id: 'c2', amount: 5 }),
      tx({ category_id: null, amount: 3 }),
      tx({ type: 'income', category_id: 'c2', amount: 999 }),
      tx({ type: 'transfer', category_id: 'c2', amount: 999 }),
    ],
    categories(2),
    'PHP',
  )
  assert.deepEqual(rows.map((r) => [r.key, r.name, r.amount]), [
    ['c1', 'Cat 1', 20],
    ['c2', 'Cat 2', 5],
    ['__none__', 'Uncategorized', 3],
  ])
  assert.deepEqual(excludedCurrencies, [])
})

test('a currency with no rate is left out of every total and named, never counted at 1', () => {
  const { rows, excludedCurrencies } = buildCategoryBreakdown(
    [
      tx({ category_id: 'c1', amount: 5 }),
      tx({ category_id: 'c1', currency: 'USD', amount: 56, exchange_rate: 1 }),
      tx({ category_id: 'c2', currency: 'EUR', amount: 3, exchange_rate: 1 }),
    ],
    categories(2),
    'PHP',
    table,
  )
  assert.deepEqual(rows.map((r) => [r.key, r.amount]), [['c1', 3141]])
  assert.deepEqual(excludedCurrencies, ['EUR'])
})

test('two categories with the same name stay separate', () => {
  const byId = new Map([
    ['a', { name: 'Food', color: '#1' }],
    ['b', { name: 'Food', color: '#2' }],
  ])
  const { rows } = buildCategoryBreakdown([tx({ category_id: 'a' }), tx({ category_id: 'b', amount: 4 })], byId, 'PHP')
  assert.deepEqual(rows.map((r) => r.key), ['a', 'b'])
})

test('12 categories keep the pie; 13 roll up into top 8 plus Other', () => {
  assert.equal(PIE_MAX_CATEGORIES, 12)
  const pie = rollupBreakdown(spread(12))
  assert.equal(pie.mode, 'pie')
  assert.equal(pie.top.length, 12)
  assert.equal(pie.other, null)

  const ranked = rollupBreakdown(spread(13))
  assert.equal(ranked.mode, 'ranked')
  assert.equal(ranked.top.length, RANKED_TOP)
  assert.equal(ranked.other.count, 5)
  assert.equal(ranked.other.amount, 5 + 4 + 3 + 2 + 1)

  assert.equal(rollupBreakdown(spread(34)).other.count, 26)
})

test('top shares plus the Other share add up to the whole', () => {
  const { top, other, total } = rollupBreakdown(spread(34))
  const sum = top.reduce((s, r) => s + r.share, 0) + other.share
  assert.ok(Math.abs(sum - 1) < 1e-9)
  assert.equal(total, (34 * 35) / 2)
})

test('Other previews its first rows and summarises the rest', () => {
  const { other } = rollupBreakdown(spread(34))
  const { shown, more } = previewOther(other)
  assert.equal(shown.length, OTHER_PREVIEW)
  assert.equal(more.count, 26 - OTHER_PREVIEW)
  assert.equal(more.amount, other.amount - shown.reduce((s, r) => s + r.amount, 0))

  const small = rollupBreakdown(spread(13)).other
  assert.equal(previewOther(small).more, null)
})

test('subcategories split each category, remainder is "No subcategory"', () => {
  const { rows: [row] } = buildCategoryBreakdown(
    [
      tx({ amount: 6, subcategory_id: 's1', subcategory: { id: 's1', name: 'Coffee' } }),
      tx({ amount: 2, subcategory_id: 's1', subcategory: { id: 's1', name: 'Coffee' } }),
      tx({ amount: 2 }),
    ],
    categories(1),
    'PHP',
  )
  assert.deepEqual(row.subcategories.map((s) => [s.name, s.amount, s.share]), [
    ['Coffee', 8, 0.8],
    ['No subcategory', 2, 0.2],
  ])
})

test('a zero total never divides by zero', () => {
  const { rows } = buildCategoryBreakdown([tx({ amount: 0 })], categories(1), 'PHP')
  assert.equal(rows[0].share, 0)
  assert.equal(rows[0].subcategories[0].share, 0)
  assert.deepEqual(rollupBreakdown([]), { mode: 'pie', total: 0, top: [], other: null })
})

test('topCategories keeps the biggest four and rolls the rest into one Other line (29a rail)', () => {
  const rows = spread(6)
  const { top, other } = topCategories(rows)
  assert.deepEqual(top.map((r) => r.key), ['c1', 'c2', 'c3', 'c4'])
  assert.equal(other.count, 2)
  assert.equal(other.amount, rows[4].amount + rows[5].amount)
})

test('topCategories has no Other line when everything fits', () => {
  assert.equal(topCategories(spread(4)).other, null)
  assert.deepEqual(topCategories([]), { top: [], other: null })
})
