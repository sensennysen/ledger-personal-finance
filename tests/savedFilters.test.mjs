import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  activityFilterPath,
  describeFilter,
  filterFromParams,
  isFilterActive,
  matchSavedFilters,
  normalizeFilterName,
  parseFilter,
  parseSavedFilters,
  restoreSavedFilterRow,
  serializeFilter,
  validateFilterName,
  EMPTY_FILTER,
} from '../src/lib/savedFilters.ts'

const rideshare = { type: 'expense', search: 'grab', tag: null }
const saved = (id, name, filter = rideshare) => ({ id, name, filter })

test('a filter round-trips through its stored JSON', () => {
  for (const filter of [EMPTY_FILTER, rideshare, { type: 'income', search: '', tag: 'salary' }]) {
    assert.deepEqual(parseFilter(serializeFilter(filter)), { ...filter, search: filter.search.trim() })
  }
})

test('stored JSON is versioned and the search is trimmed', () => {
  assert.deepEqual(serializeFilter({ type: 'all', search: '  grab ', tag: null }), { v: 1, type: 'all', search: 'grab', tag: null })
})

test('parseFilter rejects anything that is not a version 1 filter', () => {
  const bad = [
    null,
    undefined,
    'grab',
    [],
    {},
    { v: 2, type: 'all', search: '', tag: null },
    { v: 1, type: 'refund', search: '', tag: null },
    { v: 1, type: 'all', search: 5, tag: null },
    { v: 1, type: 'all', search: '', tag: 7 },
    { v: 1, type: 'all', search: '' },
  ]
  for (const raw of bad) assert.equal(parseFilter(raw), null, JSON.stringify(raw))
})

test('one unreadable row is skipped and counted, the rest are kept', () => {
  const { filters, skipped } = parseSavedFilters([
    { id: 'a', name: 'Rides', filter: serializeFilter(rideshare) },
    { id: 'b', name: 'From the future', filter: { v: 9 } },
  ])
  assert.deepEqual(filters.map((f) => f.id), ['a'])
  assert.equal(skipped, 1)
})

test('isFilterActive is false only for the empty filter', () => {
  assert.equal(isFilterActive(EMPTY_FILTER), false)
  assert.equal(isFilterActive({ ...EMPTY_FILTER, search: '   ' }), false)
  assert.equal(isFilterActive({ ...EMPTY_FILTER, type: 'income' }), true)
  assert.equal(isFilterActive({ ...EMPTY_FILTER, search: 'x' }), true)
  assert.equal(isFilterActive({ ...EMPTY_FILTER, tag: 'trip' }), true)
})

test('names are trimmed, collapsed, required, capped and unique ignoring case', () => {
  assert.equal(normalizeFilterName('  Rideshare   this quarter '), 'Rideshare this quarter')
  const existing = [saved('a', 'Rideshare')]
  assert.equal(validateFilterName('   ', existing), 'Give the filter a name.')
  assert.match(validateFilterName('x'.repeat(61), existing), /60 characters/)
  assert.match(validateFilterName(' rideSHARE ', existing), /already exists/)
  assert.equal(validateFilterName('Rideshare', existing, 'a'), null, 'renaming a filter to itself is fine')
  assert.equal(validateFilterName('Groceries', existing), null)
})

test('describeFilter says what a saved filter does', () => {
  assert.equal(describeFilter(rideshare), 'Expenses · “grab”')
  assert.equal(describeFilter({ type: 'all', search: '', tag: 'trip' }), '#trip')
  assert.equal(describeFilter({ type: 'transfer', search: 'rent', tag: 'home' }), 'Transfers · “rent” · #home')
  assert.equal(describeFilter(EMPTY_FILTER), 'All transactions')
})

test('matchSavedFilters matches the name or the description, and lists all for no query', () => {
  const list = [saved('a', 'Rideshare, this quarter'), saved('b', 'Salary', { type: 'income', search: '', tag: 'pay' })]
  assert.deepEqual(matchSavedFilters(list, '').map((f) => f.id), ['a', 'b'])
  assert.deepEqual(matchSavedFilters(list, ' RIDE ').map((f) => f.id), ['a'])
  assert.deepEqual(matchSavedFilters(list, 'income').map((f) => f.id), ['b'])
  assert.deepEqual(matchSavedFilters(list, '#pay').map((f) => f.id), ['b'])
  assert.deepEqual(matchSavedFilters(list, 'zzz'), [])
})

test('the Activity link carries the filter and reads back to the same filter', () => {
  for (const filter of [rideshare, { type: 'income', search: 'a&b=c #1', tag: 'x y' }, EMPTY_FILTER]) {
    const url = new URL(activityFilterPath(filter), 'https://ledger.test')
    assert.equal(url.pathname, '/transactions')
    assert.deepEqual(filterFromParams(url.searchParams), { ...filter, search: filter.search.trim() })
  }
})

test('a link with none of q, type or tag asks for no filter; a partial one resets the rest', () => {
  assert.equal(filterFromParams(new URLSearchParams('import=1')), null)
  assert.deepEqual(filterFromParams(new URLSearchParams('q=grab')), { type: 'all', search: 'grab', tag: null })
  assert.deepEqual(filterFromParams(new URLSearchParams('type=income')), { type: 'income', search: '', tag: null })
  assert.deepEqual(filterFromParams(new URLSearchParams('type=bogus&tag=')), { type: 'all', search: '', tag: null })
})

test('a deleted filter comes back as the same row: same id and name, filter in its stored form (LED-198)', () => {
  const original = saved('f-1', 'Rideshare', { type: 'expense', search: ' grab ', tag: 'work' })
  const row = restoreSavedFilterRow(original)
  assert.equal(row.id, 'f-1')
  assert.equal(row.name, 'Rideshare')
  assert.deepEqual(row.filter, serializeFilter(original.filter))
  assert.deepEqual(parseFilter(row.filter), { type: 'expense', search: 'grab', tag: 'work' })
})
