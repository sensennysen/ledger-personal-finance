import { test } from 'node:test'
import assert from 'node:assert/strict'
import { notifyCardPaymentsRefresh, registerCardPaymentsListener } from '../src/lib/cacheEvents.ts'

test('a card payment signal reaches every registered page once, and stops after unregistering', () => {
  let calls = 0
  const off = registerCardPaymentsListener(() => { calls++ })
  notifyCardPaymentsRefresh()
  assert.equal(calls, 1)
  off()
  notifyCardPaymentsRefresh()
  assert.equal(calls, 1)
})
