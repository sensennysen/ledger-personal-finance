import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canRollover, nextRollover, deficitOutcome, isDeficitBehaviour } from '../src/lib/budgetRollover.ts'

const run = (spends, budget, b) =>
  spends.reduce((r, s) => nextRollover(r, budget - s, budget, b), 0)

test('surplus carries under both settings', () => {
  assert.equal(run([60], 100, 'carry'), 40)
  assert.equal(run([60], 100, 'reset'), 40)
})

test('three overspent cycles: reset ignores deficit', () => {
  assert.equal(run([120, 130, 110], 100, 'reset'), 0)
})

test('three overspent cycles: carry is floored so limit stays >= 0', () => {
  assert.equal(run([120], 100, 'carry'), -20)
  assert.equal(run([120, 130, 110], 100, 'carry'), -60)
  assert.equal(run([180, 180, 180], 100, 'carry'), -100)
})

test('overspend larger than whole budget opens next cycle at zero', () => {
  const r = run([500], 100, 'carry')
  assert.equal(100 + r, 0)
})

test('only monthly budgets can roll over', () => {
  assert.equal(canRollover('monthly'), true)
  for (const p of ['weekly', 'quarterly', 'yearly']) assert.equal(canRollover(p), false)
})

test('deficitOutcome: the figure each radio shows', () => {
  assert.equal(deficitOutcome(600, 742.3, 'reset'), 600)
  assert.equal(Math.round(deficitOutcome(600, 742.3, 'carry') * 100), 45770)
})

test('deficitOutcome: carry never opens negative', () => {
  // overspend of $900 (spent $1500) exceeds the $600 budget: opens at 0, $300 is uncarried
  assert.equal(deficitOutcome(600, 1500, 'carry'), 0)
  assert.equal(deficitOutcome(600, 1200, 'carry'), 0)
  assert.equal(deficitOutcome(600, 1201, 'carry'), 0)
})

test('isDeficitBehaviour accepts only the two values', () => {
  assert.equal(isDeficitBehaviour('carry'), true)
  assert.equal(isDeficitBehaviour('reset'), true)
  for (const v of [null, undefined, '', 'CARRY', 1]) assert.equal(isDeficitBehaviour(v), false)
})
