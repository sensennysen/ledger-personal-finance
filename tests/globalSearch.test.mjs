import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseAmountQuery,
  searchTransactions,
  searchNamed,
  matchActions,
  capGroup,
  inScope,
  DESTINATIONS,
  buildDueSoon,
  summarizeLoans,
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

const deadline = (dueDate, ...items) => ({
  dueDate,
  total: items.reduce((sum, item) => sum + item.remainingAmount, 0),
  items: items.map(([purchaseId, purchaseName, remainingAmount]) => ({ purchaseId, purchaseName, remainingAmount })),
})

test('DESTINATIONS lists all seven, including Categories and Import CSV', () => {
  assert.equal(DESTINATIONS.length, 7)
  const labels = DESTINATIONS.map((d) => d.label)
  assert.ok(labels.includes('Categories'))
  assert.ok(labels.includes('Import CSV'))
})

test('buildDueSoon keeps today through the window, drops past and later', () => {
  const rows = buildDueSoon(
    [
      deadline('2026-09-14', ['a', 'Past', 1]),
      deadline('2026-09-15', ['b', 'Today', 2]),
      deadline('2026-09-29', ['c', 'Edge', 3]),
      deadline('2026-09-30', ['d', 'Later', 4]),
    ],
    '2026-09-15',
  )
  assert.deepEqual(rows.map((r) => [r.label, r.daysAway]), [['Today', 0], ['Edge', 14]])
})

test('buildDueSoon orders by date and splits same-day installments', () => {
  const rows = buildDueSoon(
    [deadline('2026-09-20', ['b', 'Zed', 5], ['a', 'Car', 6]), deadline('2026-09-16', ['c', 'Phone', 7])],
    '2026-09-15',
  )
  assert.deepEqual(rows.map((r) => r.label), ['Phone', 'Car', 'Zed'])
  assert.equal(rows[0].daysAway, 1)
})

test('buildDueSoon is empty with no deadlines and crosses month ends', () => {
  assert.deepEqual(buildDueSoon([], '2026-09-15'), [])
  assert.equal(buildDueSoon([deadline('2026-10-02', ['a', 'Car', 1])], '2026-09-30')[0].daysAway, 2)
})

test('summarizeLoans counts distinct purchases and totals what is owed', () => {
  const summary = summarizeLoans([
    deadline('2026-09-20', ['a', 'Car', 100.1], ['b', 'Phone', 50.2]),
    deadline('2026-10-20', ['a', 'Car', 100.1]),
  ])
  assert.deepEqual(summary, { count: 2, owed: 250.4 })
  assert.deepEqual(summarizeLoans([]), { count: 0, owed: 0 })
})
