import { test } from 'node:test'
import assert from 'node:assert/strict'
import { budgetUsage } from '../src/lib/budgetUsage.ts'

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
