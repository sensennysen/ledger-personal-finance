import { test } from 'node:test'
import assert from 'node:assert/strict'
import { restoreTransactionInput } from '../src/lib/undoRestore.ts'

const tx = (over = {}) => ({
  id: 't1', user_id: 'u1', created_at: 'x', updated_at: 'x', queued: false,
  account: { id: 'a1' }, to_account: null, category: null, subcategory: null,
  type: 'expense', account_id: 'a1', to_account_id: null, category_id: 'c1', subcategory_id: null,
  amount: 12.5, currency: 'USD', exchange_rate: 1, description: 'Lunch', notes: 'n', date: '2026-09-01',
  transfer_fee: 0, is_recurring: false, recurrence_interval: null, recurrence_end_date: null, receipt_url: null,
  tags: ['work', 'trip'], goal_id: 'g1',
  ...over,
})

test('undo restores tags and goal_id', () => {
  const input = restoreTransactionInput(tx())
  assert.deepEqual(input.tags, ['work', 'trip'])
  assert.equal(input.goal_id, 'g1')
})

test('missing tags and goal_id restore as empty, not undefined', () => {
  const input = restoreTransactionInput(tx({ tags: undefined, goal_id: undefined }))
  assert.deepEqual(input.tags, [])
  assert.equal(input.goal_id, null)
})

test('server-owned and joined fields are not carried into the restore', () => {
  const input = restoreTransactionInput(tx())
  for (const key of ['id', 'user_id', 'created_at', 'updated_at', 'queued', 'account', 'to_account', 'category', 'subcategory']) {
    assert.equal(key in input, false, key)
  }
})

test('every stored field survives the round trip', () => {
  const input = restoreTransactionInput(tx({ to_account_id: 'a2', type: 'transfer', transfer_fee: 1.5, receipt_url: 'r.png' }))
  assert.equal(input.to_account_id, 'a2')
  assert.equal(input.transfer_fee, 1.5)
  assert.equal(input.receipt_url, 'r.png')
  assert.equal(input.description, 'Lunch')
  assert.equal(input.date, '2026-09-01')
})
