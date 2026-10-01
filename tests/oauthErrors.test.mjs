import { test } from 'node:test'
import assert from 'node:assert/strict'
import { describeOAuthError, oauthErrorFromSearch } from '../src/lib/oauthErrors.ts'

test('known codes map to plain-language messages with a next step', () => {
  for (const code of ['access_denied', 'server_error', 'temporarily_unavailable']) {
    const m = describeOAuthError(code)
    assert.ok(m.title.length > 0, code)
    assert.match(m.body, /try again/i, code)
    assert.match(m.body, /nothing was saved/, code)
  }
})

test('unknown, empty and prototype-key codes fall back to the generic message', () => {
  const fallback = describeOAuthError(null)
  assert.deepEqual(describeOAuthError('made_up_code'), fallback)
  assert.deepEqual(describeOAuthError(''), fallback)
  assert.deepEqual(describeOAuthError('constructor'), fallback)
  assert.deepEqual(describeOAuthError('__proto__'), fallback)
})

test('the raw error_description is never echoed', () => {
  const m = oauthErrorFromSearch(
    '?error=server_error&error_description=server_error%3A+unable+to+exchange+external+code',
  )
  assert.ok(m)
  assert.doesNotMatch(`${m.title} ${m.body}`, /exchange external code|server_error/)

  const crafted = oauthErrorFromSearch('?error=phish&error_description=Call+555-0100+to+verify')
  assert.doesNotMatch(`${crafted.title} ${crafted.body}`, /555/)
})

test('no error unless both params are present', () => {
  assert.equal(oauthErrorFromSearch(''), null)
  assert.equal(oauthErrorFromSearch('?error=server_error'), null)
  assert.equal(oauthErrorFromSearch('?error_description=x'), null)
})
