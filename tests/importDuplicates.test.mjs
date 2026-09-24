import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normaliseDescription, matchDuplicates, duplicateSpan } from '../src/lib/importDuplicates.ts'

const row = (line, overrides = {}) => ({
  line,
  date: '2026-09-14',
  amount: 32.8,
  type: 'expense',
  description: 'GRABFOOD TOYO EATERY',
  ...overrides,
})

const existing = (id, overrides = {}) => ({
  id,
  date: '2026-09-14',
  amount: 32.8,
  type: 'expense',
  description: 'GRABFOOD TOYO EATERY',
  ...overrides,
})

test('normaliseDescription folds case, punctuation and reference numbers', () => {
  assert.equal(normaliseDescription('GRAB *TRIP 8842'), 'grab trip')
  assert.equal(normaliseDescription('Grab Trip 1190'), 'grab trip')
  assert.equal(normaliseDescription('  SM  Supermarket, Podium  '), 'sm supermarket podium')
  assert.equal(normaliseDescription('7-Eleven'), '7 eleven')
  assert.equal(normaliseDescription(null), '')
})

test('a row matching date, amount, type and description is a duplicate', () => {
  const matches = matchDuplicates([row(1)], [existing('a', { description: 'grabfood toyo eatery' })])
  assert.equal(matches.get(1)?.id, 'a')
})

test('different amount, date or type is not a duplicate', () => {
  const rows = [row(1, { amount: 32.81 }), row(2, { date: '2026-09-15' }), row(3, { type: 'income' })]
  assert.equal(matchDuplicates(rows, [existing('a')]).size, 0)
})

test('existing transfers never match an imported row', () => {
  assert.equal(matchDuplicates([row(1)], [existing('a', { type: 'transfer' })]).size, 0)
})

test('each existing row is matched at most once', () => {
  const matches = matchDuplicates([row(1), row(2)], [existing('a')])
  assert.deepEqual([...matches.keys()], [1])
})

test('amounts compare to the cent, whatever the stored type', () => {
  assert.equal(matchDuplicates([row(1, { amount: 0.1 + 0.2 })], [existing('a', { amount: '0.30' })]).size, 1)
})

test('re-importing a statement that overlaps last month by three days flags only the overlap', () => {
  const lastMonth = [
    existing('a', { date: '2026-08-29', description: 'NETFLIX.COM', amount: 14 }),
    existing('b', { date: '2026-08-30', description: 'SHELL KALAYAAN', amount: 52 }),
    existing('c', { date: '2026-08-31', description: 'MERALCO ONLINE PAYMENT', amount: 184.2 }),
  ]
  const statement = [
    row(1, { date: '2026-08-29', description: 'NETFLIX.COM', amount: 14 }),
    row(2, { date: '2026-08-30', description: 'SHELL KALAYAAN', amount: 52 }),
    row(3, { date: '2026-08-31', description: 'MERALCO ONLINE PAYMENT', amount: 184.2 }),
    row(4, { date: '2026-09-01', description: 'NETFLIX.COM', amount: 14 }),
  ]
  assert.deepEqual([...matchDuplicates(statement, lastMonth).keys()], [1, 2, 3])
})

test('rows without a date or amount are never matched', () => {
  assert.equal(matchDuplicates([row(1, { date: null }), row(2, { amount: null })], [existing('a')]).size, 0)
})

test('duplicateSpan covers the dated rows', () => {
  assert.deepEqual(
    duplicateSpan([{ date: '2026-09-14' }, { date: null }, { date: '2026-08-29' }, { date: '2026-09-01' }]),
    { start: '2026-08-29', end: '2026-09-14' },
  )
  assert.equal(duplicateSpan([{ date: null }]), null)
})
