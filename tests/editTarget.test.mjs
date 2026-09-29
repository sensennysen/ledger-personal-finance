import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canChangeSavedKind, resolveEditTarget } from '../src/lib/editTarget.ts'

const accounts = [
  { id: 'l1', type: 'loan' },
  { id: 'c1', type: 'credit_card' },
  { id: 's1', type: 'savings' },
]

test('no target', () => {
  assert.equal(resolveEditTarget(null, accounts), 'none')
  assert.equal(resolveEditTarget(undefined, accounts), 'none')
})

test('target type decides loan vs card', () => {
  assert.equal(resolveEditTarget('l1', accounts), 'loan')
  assert.equal(resolveEditTarget('c1', accounts), 'card')
  assert.equal(resolveEditTarget('s1', accounts), 'other')
})

test('does not guess while accounts are loading or when the target is missing', () => {
  assert.equal(resolveEditTarget('c1', []), 'pending')
  assert.equal(resolveEditTarget('gone', accounts), 'missing')
})

test('only a saved row with no liability target, or a plain one, can change kind', () => {
  assert.equal(canChangeSavedKind('none'), true)
  assert.equal(canChangeSavedKind('other'), true)
  for (const target of ['loan', 'card', 'pending', 'missing']) {
    assert.equal(canChangeSavedKind(target), false, target)
  }
})
