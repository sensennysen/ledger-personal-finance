import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planAccountSave } from '../src/lib/accountAdjustment.ts'

test('an unchanged balance needs no adjustment and keeps the payload whole', () => {
  const plan = planAccountSave(100, { name: 'Wallet', balance: 100 })
  assert.equal(plan.adjustment, null)
  assert.deepEqual(plan.updatePayload, { name: 'Wallet', balance: 100 })
})

test('no balance in the values means no adjustment', () => {
  const plan = planAccountSave(100, { name: 'Wallet' })
  assert.equal(plan.adjustment, null)
  assert.deepEqual(plan.updatePayload, { name: 'Wallet' })
})

test('a higher balance is an income adjustment and leaves the balance out of the update', () => {
  const plan = planAccountSave(100, { name: 'Wallet', balance: 130 })
  assert.deepEqual(plan.adjustment, { type: 'income', amount: 30 })
  assert.deepEqual(plan.updatePayload, { name: 'Wallet' })
})

test('a lower balance is an expense adjustment for the absolute gap', () => {
  const plan = planAccountSave(100, { balance: -20 })
  assert.deepEqual(plan.adjustment, { type: 'expense', amount: 120 })
  assert.equal('balance' in plan.updatePayload, false)
})

test('planning never mutates the values it was given', () => {
  const values = { name: 'Wallet', balance: 130 }
  planAccountSave(100, values)
  assert.deepEqual(values, { name: 'Wallet', balance: 130 })
})
