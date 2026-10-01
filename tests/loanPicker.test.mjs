import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hasLoanPickerStep, nextDeadlineInCycle, resolveInitialLoanId, sortLoanChoices } from '../src/lib/loanPicker.ts'

const loan = (id) => ({ id })

test('no loans: nothing is picked', () => {
  assert.equal(resolveInitialLoanId([], null, 'none'), null)
})

test('exactly one loan is picked', () => {
  assert.equal(resolveInitialLoanId([loan('a')], null, 'none'), 'a')
})

test('two or more loans: nothing is picked', () => {
  assert.equal(resolveInitialLoanId([loan('a'), loan('b')], null, 'none'), null)
  assert.equal(resolveInitialLoanId([loan('a'), loan('b'), loan('c')], undefined, 'none'), null)
})

test('a locked loan wins regardless of how many loans exist', () => {
  assert.equal(resolveInitialLoanId([loan('a'), loan('b')], 'b', 'none'), 'b')
  assert.equal(resolveInitialLoanId([loan('a')], 'a', 'none'), 'a')
  assert.equal(resolveInitialLoanId([], 'a', 'none'), 'a')
})

test('editing a saved repayment never auto-picks; the form keeps its own loan', () => {
  assert.equal(resolveInitialLoanId([loan('a')], null, 'loan'), null)
  assert.equal(resolveInitialLoanId([loan('a'), loan('b')], null, 'loan'), null)
})

const choice = (id, outstanding, nextDeadline = null) => ({ id, name: id, schedule: null, outstanding, nextDeadline })
const due = (date) => ({ date, amount: 100 })

test('sortLoanChoices: nearest due date first', () => {
  const sorted = sortLoanChoices([
    choice('late', 900, due('2026-10-20')),
    choice('soon', 100, due('2026-10-05')),
  ])
  assert.deepEqual(sorted.map((item) => item.id), ['soon', 'late'])
})

test('sortLoanChoices: same date falls back to the largest outstanding', () => {
  const sorted = sortLoanChoices([
    choice('small', 100, due('2026-10-05')),
    choice('big', 900, due('2026-10-05')),
  ])
  assert.deepEqual(sorted.map((item) => item.id), ['big', 'small'])
})

test('sortLoanChoices: a loan with nothing due sorts after dated ones, by outstanding', () => {
  const sorted = sortLoanChoices([
    choice('none-small', 50),
    choice('dated', 10, due('2026-12-01')),
    choice('none-big', 500),
  ])
  assert.deepEqual(sorted.map((item) => item.id), ['dated', 'none-big', 'none-small'])
})

test('sortLoanChoices does not mutate its input', () => {
  const input = [choice('b', 1), choice('a', 2)]
  sortLoanChoices(input)
  assert.deepEqual(input.map((item) => item.id), ['b', 'a'])
})

test('hasLoanPickerStep: only for two or more loans, not locked, not editing', () => {
  assert.equal(hasLoanPickerStep({ loanCount: 2, lockedLoanAccountId: null, isEditing: false }), true)
  assert.equal(hasLoanPickerStep({ loanCount: 5, lockedLoanAccountId: undefined, isEditing: false }), true)
  assert.equal(hasLoanPickerStep({ loanCount: 1, lockedLoanAccountId: null, isEditing: false }), false)
  assert.equal(hasLoanPickerStep({ loanCount: 0, lockedLoanAccountId: null, isEditing: false }), false)
  assert.equal(hasLoanPickerStep({ loanCount: 3, lockedLoanAccountId: 'a', isEditing: false }), false)
  assert.equal(hasLoanPickerStep({ loanCount: 3, lockedLoanAccountId: null, isEditing: true }), false)
})

test('nextDeadlineInCycle: the nearest deadline on or before the cycle end, overdue included', () => {
  const deadlines = [
    { dueDate: '2026-09-15', total: 600, items: [] },
    { dueDate: '2026-10-15', total: 610, items: [] },
  ]
  assert.equal(nextDeadlineInCycle(deadlines, '2026-10-24')?.dueDate, '2026-09-15')
  assert.equal(nextDeadlineInCycle(deadlines.slice(1), '2026-10-15')?.dueDate, '2026-10-15')
})

test('nextDeadlineInCycle: null when the next deadline falls after the cycle, or there are none', () => {
  assert.equal(nextDeadlineInCycle([{ dueDate: '2026-11-15', total: 5, items: [] }], '2026-10-24'), null)
  assert.equal(nextDeadlineInCycle([], '2026-10-24'), null)
})
