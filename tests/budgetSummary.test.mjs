import { test } from 'node:test'
import assert from 'node:assert/strict'
import { summarizeBudgets, sortByUsage, needsAttention, cycleDaysLeft } from '../src/lib/budgetSummary.ts'
import { spendByCategory, lastCycleCandidates } from '../src/lib/budgetSuggestions.ts'

const budget = (id, spent, amount, extra = {}) => ({
  id,
  name: id,
  currency: 'PHP',
  period: 'monthly',
  amount,
  spent,
  category: { name: id[0].toUpperCase() + id.slice(1) },
  ...extra,
})

// The 4b figures: 8 budgets, $4,250 planned, $3,812.65 spent, Dining and Transport over.
const list = [
  budget('dining', 742.3, 600),
  budget('transport', 318, 300),
  budget('groceries', 1012.4, 1200),
  budget('utilities', 284.1, 400),
]

test('summarizeBudgets adds monthly budgets in the currency and names what is over', () => {
  const s = summarizeBudgets(list, 'PHP')
  assert.equal(s.counted, 4)
  assert.equal(s.budgeted, 2500)
  assert.equal(Math.round(s.spent * 100) / 100, 2356.8)
  assert.equal(Math.round(s.remaining * 100) / 100, 143.2)
  assert.equal(s.overCount, 2)
  assert.deepEqual(s.overNames, ['Dining', 'Transport'])
})

test('scheduled spend is added apart and left out of spent and remaining (LED-238)', () => {
  const s = summarizeBudgets([budget('dining', 100, 600, { scheduled: 250 }), budget('rent', 0, 900, { currency: 'USD', scheduled: 900 })], 'PHP')
  assert.equal(s.spent, 100)
  assert.equal(s.scheduled, 250)
  assert.equal(s.remaining, 500)
})

test('rollover raises the limit the tiles add up', () => {
  const s = summarizeBudgets([budget('dining', 700, 600, { effective_amount: 750 })], 'PHP')
  assert.equal(s.budgeted, 750)
  assert.equal(s.overCount, 0)
})

test('other currencies and other periods are counted, never added', () => {
  const s = summarizeBudgets(
    [...list, budget('trip', 50, 100, { currency: 'EUR' }), budget('car', 900, 1000, { period: 'yearly' })],
    'PHP',
  )
  assert.equal(s.budgeted, 2500)
  assert.equal(s.otherCurrency, 1)
  assert.equal(s.otherPeriod, 1)
})

test('an income-category budget is counted but never added to Budgeted/Remaining (LED-181 item, OD-8)', () => {
  const s = summarizeBudgets(
    [...list, budget('sidegig', 200, 5000, { category: { name: 'Side gig', type: 'income' } })],
    'PHP',
  )
  assert.equal(s.budgeted, 2500)
  assert.equal(s.counted, 4)
  assert.equal(s.otherType, 1)
})

test('sortByUsage orders by percent used, a zero limit with spending first, ties stable', () => {
  const rows = [
    budget('a', 50, 100),
    budget('b', 124, 100),
    budget('c', 10, 0),
    budget('d', 50, 100),
    budget('e', 0, 0),
  ]
  assert.deepEqual(sortByUsage(rows).map((row) => row.id), ['c', 'b', 'a', 'd', 'e'])
  assert.deepEqual(rows.map((row) => row.id), ['a', 'b', 'c', 'd', 'e'])
})

test('needsAttention lists over-budget by overspend, then near the limit by use', () => {
  const items = needsAttention([
    ...list,
    budget('subs', 85, 100),
    budget('fun', 95, 100),
    budget('rent', 80, 100),
    budget('mid', 30, 100),
  ])
  assert.deepEqual(
    items.map((item) => [item.kind, item.name]),
    [['over', 'Dining'], ['over', 'Transport'], ['near', 'Fun'], ['near', 'Subs'], ['near', 'Groceries']],
  )
  assert.equal(Math.round(items[0].overBy * 100) / 100, 142.3)
  assert.equal(items[4].usedPct, 84)
})

test('exactly 100% used is near the limit, not over', () => {
  const items = needsAttention([budget('full', 100, 100)])
  assert.deepEqual(items.map((item) => item.kind), ['near'])
})

test('cycleDaysLeft counts to the last day and is null outside the cycle', () => {
  assert.equal(cycleDaysLeft('2026-09-01', '2026-09-30', '2026-09-09'), 21)
  assert.equal(cycleDaysLeft('2026-09-01', '2026-09-30', '2026-09-30'), 0)
  assert.equal(cycleDaysLeft('2026-09-01', '2026-09-30', '2026-10-01'), null)
  assert.equal(cycleDaysLeft('2026-09-01', '2026-09-30', '2026-08-31'), null)
})

const tx = (category_id, amount, date, extra = {}) => ({
  category_id,
  amount,
  date,
  currency: 'PHP',
  exchange_rate: null,
  ...extra,
})

test('spendByCategory sums inside the range, converts with a rate and reports unrated', () => {
  const rows = spendByCategory(
    [
      tx('g', 100, '2026-08-05'),
      tx('g', 50.5, '2026-08-30'),
      tx('g', 999, '2026-09-02'),
      tx('t', 20, '2026-08-10', { currency: 'USD', exchange_rate: 50 }),
      tx('t', 5, '2026-08-11', { currency: 'EUR' }),
      tx(null, 70, '2026-08-12'),
    ],
    '2026-08-01',
    '2026-08-31',
    'PHP',
  )
  const by = Object.fromEntries(rows.map((row) => [row.category_id, row]))
  assert.equal(by.g.spent, 150.5)
  assert.equal(by.t.spent, 1000)
  assert.deepEqual(by.t.unrated, ['EUR'])
  assert.equal(rows.length, 2)
})

test('lastCycleCandidates skips budgeted categories, rounds up and orders by spend', () => {
  const spend = [
    { category_id: 'a', spent: 120.2, unrated: [] },
    { category_id: 'b', spent: 900, unrated: [] },
    { category_id: 'c', spent: 0, unrated: [] },
    { category_id: 'd', spent: 50, unrated: [] },
  ]
  assert.deepEqual(lastCycleCandidates(spend, ['d']), [
    { category_id: 'b', amount: 900 },
    { category_id: 'a', amount: 121 },
  ])
  assert.deepEqual(lastCycleCandidates([], []), [])
})
