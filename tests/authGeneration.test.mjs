import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAuthGeneration } from '../src/lib/authGeneration.ts'

test('a read stays current while nothing changes', () => {
  const auth = createAuthGeneration()
  const token = auth.begin('a')
  assert.equal(auth.isCurrent(token, 'a'), true)
})

test('sign-out drops a read that is still in flight', () => {
  const auth = createAuthGeneration()
  const token = auth.begin('a')
  auth.invalidate()
  assert.equal(auth.isCurrent(token, null), false)
  assert.equal(auth.isCurrent(token, 'a'), false, 'signing back in as A does not revive the old read')
})

test('a switch to another account drops the first account\'s read', () => {
  const auth = createAuthGeneration()
  const fromA = auth.begin('a')
  auth.invalidate()
  const fromB = auth.begin('b')
  assert.equal(auth.isCurrent(fromA, 'b'), false)
  assert.equal(auth.isCurrent(fromB, 'b'), true)
})

test('a read is not current for a user other than the one it was started for', () => {
  const auth = createAuthGeneration()
  const token = auth.begin('a')
  assert.equal(auth.isCurrent(token, 'b'), false)
})

test('a newer read for the same user supersedes the older one', () => {
  const auth = createAuthGeneration()
  const older = auth.begin('a')
  const newer = auth.begin('a')
  assert.equal(auth.isCurrent(older, 'a'), false)
  assert.equal(auth.isCurrent(newer, 'a'), true)
})
