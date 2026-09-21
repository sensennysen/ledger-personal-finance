import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseAmountQuery,
  searchTransactions,
  searchNamed,
  matchActions,
  capGroup,
  inScope,
} from '../src/lib/globalSearch.ts'

const range = { start: '2026-09-01', end: '2026-09-30' }
const tx = (id, amount, extra = {}) => ({
  id,
  amount,
  date: '2026-09-09',
  description: 'Misc',
  notes: null,
  account: { name: 'Everyday Checking' },
  to_account: null,
  category: { name: 'Groceries' },
  ...extra,
})
const ids = (rows) => rows.map((row) => row.id)

test('parseAmountQuery reads plain, grouped and currency-prefixed numbers', () => {
  assert.equal(parseAmountQuery('86.40'), 86.4)
  assert.equal(parseAmountQuery('1,012.40'), 1012.4)
  assert.equal(parseAmountQuery('$86'), 86)
  assert.equal(parseAmountQuery('-86.40'), 86.4)
})

test('parseAmountQuery rejects words and mixed text', () => {
  assert.equal(parseAmountQuery('grocery'), null)
  assert.equal(parseAmountQuery('7-eleven'), null)
  assert.equal(parseAmountQuery('86 groceries'), null)
  assert.equal(parseAmountQuery(''), null)
})

test('text matches description, notes, account, to-account and category', () => {
  const rows = [
    tx('d', 5, { description: 'Grocery run' }),
    tx('n', 5, { notes: 'weekly grocery top-up', description: 'x', category: null }),
    tx('a', 5, { description: 'x', category: null, account: { name: 'Grocery Card' } }),
    tx('t', 5, { description: 'x', category: null, to_account: { name: 'Grocery Fund' } }),
    tx('c', 5, { description: 'x', category: { name: 'Groceries' }, account: { name: 'Cash' } }),
    tx('miss', 5, { description: 'Rent', category: { name: 'Housing' } }),
  ]
  const { text } = searchTransactions(rows, 'grocer', 'all', range)
  assert.deepEqual(ids(text).sort(), ['a', 'c', 'd', 'n', 't'])
})

test('text match is case-insensitive and empty query matches nothing', () => {
  const rows = [tx('a', 5, { description: 'GROCERY' })]
  assert.equal(searchTransactions(rows, 'grocery', 'all', range).text.length, 1)
  const none = searchTransactions(rows, '  ', 'all', range)
  assert.deepEqual([none.exact, none.nearby, none.text], [[], [], []])
})

test('numeric query: exact first, then a +/-5% band nearest first', () => {
  const rows = [
    tx('far', -100),
    tx('band-high', -88.05),
    tx('exact', -86.4),
    tx('band-low', -84.6),
    tx('edge', -90.72),
  ]
  const { exact, nearby } = searchTransactions(rows, '86.40', 'all', range)
  assert.deepEqual(ids(exact), ['exact'])
  assert.deepEqual(ids(nearby), ['band-high', 'band-low', 'edge'])
})

test('band is inclusive at 5% and excludes beyond it', () => {
  const rows = [tx('in', 105), tx('out', 105.01), tx('low', 95)]
  const { nearby } = searchTransactions(rows, '100', 'all', range)
  assert.deepEqual(ids(nearby).sort(), ['in', 'low'])
})

test('amounts match by magnitude regardless of sign', () => {
  const rows = [tx('e', -50), tx('i', 50)]
  assert.deepEqual(ids(searchTransactions(rows, '50', 'all', range).exact).sort(), ['e', 'i'])
})

test('a numeric query also finds text matches, without duplicating amount hits', () => {
  const rows = [
    tx('amount', 24, { description: 'Lunch' }),
    tx('both', 24, { description: 'Route 24 bus' }),
    tx('text', 9, { description: 'Route 24 bus' }),
  ]
  const { exact, text } = searchTransactions(rows, '24', 'all', range)
  assert.deepEqual(ids(exact).sort(), ['amount', 'both'])
  assert.deepEqual(ids(text), ['text'])
})

test('zero has no band', () => {
  const rows = [tx('z', 0), tx('one', 0.01)]
  const { exact, nearby } = searchTransactions(rows, '0', 'all', range)
  assert.deepEqual(ids(exact), ['z'])
  assert.deepEqual(nearby, [])
})

test('cycle scope keeps only rows inside the range, boundaries included', () => {
  const rows = [
    tx('before', 5, { date: '2026-08-31' }),
    tx('first', 5, { date: '2026-09-01' }),
    tx('last', 5, { date: '2026-09-30T12:00:00Z' }),
    tx('after', 5, { date: '2026-10-01' }),
  ]
  assert.deepEqual(ids(inScope(rows, 'cycle', range)), ['first', 'last'])
  assert.equal(inScope(rows, 'all', range).length, 4)
  const hits = searchTransactions(rows, 'misc', 'cycle', range).text
  assert.deepEqual(ids(hits), ['first', 'last'])
})

test('searchNamed filters accounts and categories by name', () => {
  const rows = [{ id: '1', name: 'Groceries' }, { id: '2', name: 'Rent' }]
  assert.deepEqual(ids(searchNamed(rows, 'gro')), ['1'])
  assert.deepEqual(searchNamed(rows, ''), [])
})

test('matchActions lists all on empty query and filters by label or keyword', () => {
  const actions = [
    { id: 'expense', label: 'New expense', keywords: ['spend', 'add'], key: 'E' },
    { id: 'income', label: 'New income', keywords: ['earn', 'add'], key: 'I' },
  ]
  assert.equal(matchActions(actions, '').length, 2)
  assert.deepEqual(ids(matchActions(actions, 'expen')), ['expense'])
  assert.deepEqual(ids(matchActions(actions, 'earn')), ['income'])
  assert.deepEqual(matchActions(actions, 'zzz'), [])
})

test('capGroup limits drawn rows but keeps the true total', () => {
  const group = capGroup([1, 2, 3, 4, 5], 3)
  assert.deepEqual(group.items, [1, 2, 3])
  assert.equal(group.total, 5)
})
