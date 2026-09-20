import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeAuthError, authErrorActionLabel } from '../src/lib/authErrors.ts'

test('sign-out failure says the user is still signed in', () => {
  const e = makeAuthError('signout', 'network down')
  assert.equal(e.kind, 'signout')
  assert.match(e.message, /still signed in/)
  assert.equal(e.detail, 'network down')
})

test('detail defaults to null', () => {
  assert.equal(makeAuthError('profile').detail, null)
})

test('each kind has a distinct message and action label', () => {
  const kinds = ['profile', 'session', 'signout']
  assert.equal(new Set(kinds.map((k) => makeAuthError(k).message)).size, 3)
  assert.equal(authErrorActionLabel('session'), 'Reload')
  assert.equal(authErrorActionLabel('signout'), 'Try again')
})
