import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isSalaryCategory,
  salaryOnlySelection,
  excludedByCategory,
  groupByMonth,
  UNCATEGORISED,
} from '../src/lib/thirteenthMonth.ts'

const rec = (id, date, name) => ({ id, date, category: name === undefined ? null : { name } })

const records = [
  rec('a', '2026-08-08', 'Salary'),
  rec('b', '2026-08-30', 'Bonus'),
  rec('c', '2026-09-08', 'Salary'),
  rec('d', '2026-09-15', 'Freelance'),
  rec('e', '2026-09-20', undefined),
  rec('f', '2026-07-10', 'Wages'),
]

test('salary-like category names match, others do not', () => {
  for (const n of ['Salary', 'salary', 'Monthly Salary', 'Wages', 'Wage', 'Basic Pay', 'Payroll']) {
    assert.equal(isSalaryCategory(n), true, n)
  }
  for (const n of ['Bonus', 'Allowance', 'Freelance', 'Salaryman fund', '', null, undefined]) {
    assert.equal(isSalaryCategory(n), false, String(n))
  }
})

test('salary-only selection ticks salary records and skips uncategorised', () => {
  assert.deepEqual([...salaryOnlySelection(records)].sort(), ['a', 'c', 'f'])
})

test('excluded records are counted by category, uncategorised grouped', () => {
  const included = salaryOnlySelection(records)
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
