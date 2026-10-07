import { test } from 'node:test'
import assert from 'node:assert/strict'
import { notifyEntityChanged, registerEntityListener } from '../src/lib/cacheEvents.ts'

test('a card payment signal reaches every registered page once, and stops after unregistering', () => {
  let calls = 0
  const off = registerEntityListener('card-payments', () => { calls++ })
  notifyEntityChanged('card-payments')
  assert.equal(calls, 1)
  off()
  notifyEntityChanged('card-payments')
  assert.equal(calls, 1)
})

test('a signal for one entity does not reach listeners of another', () => {
  let calls = 0
  const off = registerEntityListener('budgets', () => { calls++ })
  notifyEntityChanged('loan-purchases')
  assert.equal(calls, 0)
  off()
})
