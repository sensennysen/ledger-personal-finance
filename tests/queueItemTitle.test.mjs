import { test } from 'node:test'
import assert from 'node:assert/strict'
import { itemTitle, itemNote } from '../src/lib/queueItemTitle.ts'

const base = {
  id: '1',
  table: 'transactions',
  operation: 'update',
  payload: {},
  userId: 'u1',
  timestamp: Date.now(),
}

test('a partial update payload (no description) falls back to the item label (LED-160)', () => {
  const item = { ...base, operation: 'update', payload: { category_id: 'cat_1' }, label: 'Electricity bill' }
  assert.equal(itemTitle(item), 'Electricity bill')
})

test('a delete (empty payload) keeps the name it was queued with', () => {
  const item = { ...base, operation: 'delete', payload: {}, label: 'Grocery run' }
  assert.equal(itemTitle(item), 'Grocery run')
})

test('payload.description wins when present', () => {
  const item = { ...base, payload: { description: 'Coffee' }, label: undefined }
  assert.equal(itemTitle(item), 'Coffee')
})

test('an unlabelled item with no name anywhere falls back to a humanized, singular table name, never the raw table', () => {
  const item = { ...base, payload: {}, label: undefined }
  assert.equal(itemTitle(item), 'Transaction')
  assert.notEqual(itemTitle(item), 'transactions')
})

test('an unrecognised table is still singularized and capitalized, not shown raw', () => {
  const item = { ...base, table: 'budget_lines', payload: {}, label: undefined }
  assert.equal(itemTitle(item), 'Budget line')
})

test('a conflict falls back to serverSnapshot when payload and label have no name', () => {
  const item = {
    ...base,
    status: 'conflict',
    conflictKind: 'edited',
    payload: { category_id: 'cat_1' },
    serverSnapshot: { description: 'Coffee', category_id: 'cat_2' },
    label: undefined,
  }
  assert.equal(itemTitle(item), 'Coffee')
})

test('itemNote never shows a raw table name either', () => {
  const item = { ...base, table: 'profiles', payload: {} }
  assert.equal(itemNote(item), 'Edit · Profile')
})

test('a pending item whose server check failed says so, and that it will be tried again (LED-297)', async () => {
  const { SERVER_CHECK_FAILED } = await import('../src/lib/queueDrain.ts')
  assert.equal(itemNote({ ...base, lastError: SERVER_CHECK_FAILED }), SERVER_CHECK_FAILED)
  assert.match(SERVER_CHECK_FAILED, /tried again/)
  assert.equal(itemNote({ ...base, lastError: 'amount', attempts: 2 }), 'Edit · Transaction', 'a database error under the limit keeps its usual note')
})
