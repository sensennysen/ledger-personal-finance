import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeAuthError, authErrorActionLabel, describeOAuthStartFailure } from '../src/lib/authErrors.ts'

test('sign-out message is true when the server call failed: signed out locally, not still signed in', () => {
  const e = makeAuthError('signout', 'network down')
  assert.equal(e.kind, 'signout')
  assert.doesNotMatch(e.message, /still signed in/)
  assert.match(e.message, /signed out/i)
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

test('a failed Google sign-in start gets a plain message that depends only on being online (LED-196)', () => {
  const online = describeOAuthStartFailure(true)
  const offline = describeOAuthStartFailure(false)
  assert.match(online.title, /start Google sign-in/i)
  assert.match(online.body, /try again/i)
  assert.match(offline.body, /offline/i)
  assert.notEqual(online.body, offline.body)
})
