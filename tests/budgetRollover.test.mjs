import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextRollover } from '../src/lib/budgetRollover.ts'

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
