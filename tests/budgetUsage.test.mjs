import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BUDGET_TONE_BAR_CLASS, BUDGET_WARNING_THRESHOLD, budgetTone, budgetUsage } from '../src/lib/budgetUsage.ts'

test('over budget caps the bar and keeps the true percentage', () => {
  assert.deepEqual(budgetUsage(742.3, 600), { usedPct: 124, barPct: 100, over: true })
})

test('under budget fills proportionally', () => {
  const u = budgetUsage(300, 400)
  assert.equal(u.usedPct, 75)
  assert.equal(u.barPct, 75)
  assert.equal(u.over, false)
})

test('exactly on the limit is not over', () => {
  assert.equal(budgetUsage(600, 600).over, false)
  assert.equal(budgetUsage(600, 600).usedPct, 100)
})

test('a zero limit with spending is over with no percentage', () => {
  assert.deepEqual(budgetUsage(20, 0), { usedPct: null, barPct: 100, over: true })
  assert.deepEqual(budgetUsage(0, 0), { usedPct: 0, barPct: 0, over: false })
})

test('refunds past zero never draw a negative bar', () => {
  assert.equal(budgetUsage(-50, 100).barPct, 0)
})

test('budgetTone: fine up to the threshold, gold above it, expense when over', () => {
  assert.equal(budgetTone(0, false), 'income')
  assert.equal(budgetTone(BUDGET_WARNING_THRESHOLD, false), 'income')
  assert.equal(budgetTone(BUDGET_WARNING_THRESHOLD + 1, false), 'gold')
  assert.equal(budgetTone(100, false), 'gold')
  assert.equal(budgetTone(101, false), 'expense')
  assert.equal(budgetTone(100, true), 'expense')
})

test('every tone has a bar class', () => {
  for (const tone of ['income', 'gold', 'expense']) assert.match(BUDGET_TONE_BAR_CLASS[tone], /progress-indicator/)
})
