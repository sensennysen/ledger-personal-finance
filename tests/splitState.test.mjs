import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveSplit } from '../src/lib/splitState.ts'

const line = (description, amount) => ({ description, amount })

test('a balanced split with named, non-zero lines has no blockers', () => {
  const s = resolveSplit(86.4, [line('Groceries', 62.4), line('Cleaning', 24)])
  assert.equal(s.balanced, true)
  assert.deepEqual(s.blockers, [])
})

test('the unassigned remainder is offered to the cent', () => {
  const s = resolveSplit(86.4, [line('Groceries', 62.4), line('Cleaning', 14.6)])
  assert.equal(s.unassigned, 9.4)
  assert.equal(s.overAllocated, 0)
  assert.deepEqual(s.blockers, [{ kind: 'unbalanced' }])
})

test('over-allocation is reported against the transaction, not as unassigned', () => {
  const s = resolveSplit(50, [line('A', 30), line('B', 25)])
  assert.equal(s.overAllocated, 5)
  assert.equal(s.unassigned, 0)
})

test('float noise does not unbalance a split', () => {
  assert.equal(resolveSplit(0.3, [line('A', 0.1), line('B', 0.2)]).balanced, true)
})

test('each disabled cause is named separately, with the lines it applies to', () => {
  const s = resolveSplit(100, [line('A', 100), line('  ', 0), line('C', 0)])
  assert.deepEqual(s.blockers, [
    { kind: 'blank-description', lines: [1] },
    { kind: 'zero-amount', lines: [1, 2] },
  ])
})

test('all three causes can apply at once', () => {
  const s = resolveSplit(100, [line('A', 40), line('', 0)])
  assert.deepEqual(s.blockers.map((b) => b.kind), ['unbalanced', 'blank-description', 'zero-amount'])
})
