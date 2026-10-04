import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  salaryOnlySelection,
  excludedByCategory,
  groupByMonth,
  UNCATEGORISED,
} from '../src/lib/thirteenthMonth.ts'

// Each name stands for one category; its id is derived from the name.
const rec = (id, date, name, categoryId) => ({
  id,
  date,
  category_id: name === undefined ? null : categoryId ?? `cat-${name}`,
  category: name === undefined ? null : { name },
})
// The categories flagged counts_as_salary (LED-236).
const salaryIds = new Set(['cat-Salary', 'cat-Wages'])

const records = [
  rec('a', '2026-08-08', 'Salary'),
  rec('b', '2026-08-30', 'Bonus'),
  rec('c', '2026-09-08', 'Salary'),
  rec('d', '2026-09-15', 'Freelance'),
  rec('e', '2026-09-20', undefined),
  rec('f', '2026-07-10', 'Wages'),
]

test('salary-only selection ticks flagged categories and skips uncategorised', () => {
  assert.deepEqual([...salaryOnlySelection(records, salaryIds)].sort(), ['a', 'c', 'f'])
})

test('the flag decides, not the name', () => {
  const rows = [
    rec('p', '2026-08-15', 'Acme pay', 'cat-acme'), // flagged, name not salary-like
    rec('q', '2026-08-15', 'Salary', 'cat-old-salary'), // salary-like name, not flagged
  ]
  assert.deepEqual([...salaryOnlySelection(rows, new Set(['cat-acme']))], ['p'])
  assert.deepEqual([...salaryOnlySelection(rows, new Set())], [])
})

test('renaming a flagged category keeps it salary', () => {
  const before = [rec('r', '2026-08-15', 'Salary', 'cat-1')]
  const after = [rec('r', '2026-08-15', 'Main job', 'cat-1')]
  const flagged = new Set(['cat-1'])
  assert.deepEqual([...salaryOnlySelection(before, flagged)], ['r'])
  assert.deepEqual([...salaryOnlySelection(after, flagged)], ['r'])
})

test('excluded records are counted by category, uncategorised grouped', () => {
  const included = salaryOnlySelection(records, salaryIds)
  assert.deepEqual(excludedByCategory(records, included), [
    { name: 'Bonus', count: 1 },
    { name: 'Freelance', count: 1 },
    { name: UNCATEGORISED, count: 1 },
  ])
  assert.deepEqual(excludedByCategory(records, new Set(records.map((r) => r.id))), [])
})

test('months ascend and records within a month are newest first', () => {
  const grouped = groupByMonth(records)
  assert.deepEqual(grouped.map(([k]) => k), ['2026-07', '2026-08', '2026-09'])
  assert.deepEqual(grouped[2][1].map((r) => r.id), ['e', 'd', 'c'])
})

import { monthCoverage, pd851Checklist } from '../src/lib/thirteenthMonth.ts'

const inc = (...ids) => new Set(ids)
const statuses = (coverage) => coverage.map((month) => month.status)

test('a full year of ticked salary is covered for every elapsed month', () => {
  const salary = Array.from({ length: 12 }, (_, i) =>
    rec(`s${i}`, `2025-${String(i + 1).padStart(2, '0')}-08`, 'Salary'),
  )
  const coverage = monthCoverage(salary, new Set(salary.map((r) => r.id)), 2025, '2026-01-15')
  assert.equal(coverage.length, 12)
  assert.deepEqual(new Set(statuses(coverage)), new Set(['covered']))
})

test('a month with some records ticked is partial', () => {
  const rows = [rec('a', '2026-08-08', 'Salary'), rec('b', '2026-08-30', 'Bonus')]
  const coverage = monthCoverage(rows, inc('a'), 2026, '2026-09-25')
  assert.equal(coverage[7].status, 'partial')
  assert.equal(coverage[7].includedCount, 1)
  assert.equal(coverage[7].totalCount, 2)
})

test('an elapsed month with nothing ticked, or no income, is missing', () => {
  const rows = [rec('a', '2026-08-08', 'Salary'), rec('b', '2026-06-08', 'Salary')]
  const coverage = monthCoverage(rows, inc('a'), 2026, '2026-09-25')
  assert.equal(coverage[5].status, 'missing') // June: income exists, none ticked
  assert.equal(coverage[6].status, 'missing') // July: no income at all
  assert.equal(coverage[7].status, 'covered')
})

test('months after the current one are future, and the current month is not', () => {
  const coverage = monthCoverage([rec('a', '2026-09-08', 'Salary')], inc('a'), 2026, '2026-09-25')
  assert.deepEqual(statuses(coverage).slice(8), ['covered', 'future', 'future', 'future'])
})

test('a past year has no future months and a later year is all future', () => {
  assert.equal(statuses(monthCoverage([], inc(), 2024, '2026-09-25')).includes('future'), false)
  assert.deepEqual(new Set(statuses(monthCoverage([], inc(), 2027, '2026-09-25'))), new Set(['future']))
})

test('pd851Checklist ticks basic salary and crosses the three excluded kinds', () => {
  const rows = pd851Checklist([], inc(), salaryIds)
  assert.deepEqual(rows.map((r) => [r.id, r.counts]), [
    ['basic', true],
    ['overtime', false],
    ['allowances', false],
    ['other', false],
  ])
  assert.equal(rows.length, 4)
})

test('pd851Checklist counts ticked records that look like an excluded kind', () => {
  const rows = pd851Checklist(
    [
      rec('a', '2026-08-08', 'Salary'),
      rec('b', '2026-08-30', 'Bonus'),
      rec('c', '2026-09-01', 'Night differential'),
      rec('d', '2026-09-02', 'Freelance'),
      rec('e', '2026-09-03', 'Bonus'),
      rec('f', '2026-09-04', undefined),
    ],
    inc('a', 'b', 'c', 'd', 'f'),
    salaryIds,
  )
  const by = Object.fromEntries(rows.map((r) => [r.id, r.selected]))
  assert.deepEqual(by, { basic: 1, overtime: 1, allowances: 1, other: 1 })
})

test('an unticked record never counts toward a row', () => {
  const rows = pd851Checklist([rec('b', '2026-08-30', 'Bonus')], inc(), salaryIds)
  assert.equal(rows.every((r) => r.selected === 0), true)
})
