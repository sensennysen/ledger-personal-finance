import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyDataError, describeDataError, withDetail, toResult } from '../src/lib/dataErrors.ts'

test('no error describes to null', () => {
  assert.equal(describeDataError(null, { action: 'load' }), null)
  assert.deepEqual(toResult(null, { action: 'save' }), { error: null, errorDetail: null })
})

test('connection failures by code and by message', () => {
  assert.equal(classifyDataError({ code: '08006', message: 'could not establish connection' }), 'connection')
  assert.equal(classifyDataError('TypeError: Failed to fetch'), 'connection')
  assert.equal(classifyDataError(new TypeError('NetworkError when attempting to fetch resource.')), 'connection')
})

test('a failed save over a dropped connection promises nothing was changed', () => {
  const d = describeDataError({ code: '08006', message: 'could not establish connection' }, { action: 'save' })
  assert.match(d.message, /Nothing was changed/)
  assert.equal(d.detail, '08006 — could not establish connection')
})

test('a failed load does not claim anything about changes', () => {
  const d = describeDataError('Failed to fetch', { action: 'load' })
  assert.doesNotMatch(d.message, /Nothing was changed/)
})

test('unique violation names the record when it can', () => {
  const err = { code: '23505', message: 'duplicate key value violates unique constraint "categories_user_id_name_key"' }
  assert.equal(describeDataError(err, { action: 'save', entity: 'category' }).message, 'A category with that name already exists.')
  assert.equal(describeDataError(err, { action: 'save' }).message, 'That already exists.')
  assert.equal(classifyDataError('duplicate key value violates unique constraint'), 'unique')
})

test('RLS denial by code and by message', () => {
  assert.equal(classifyDataError({ code: '42501', message: 'new row violates row-level security policy' }), 'permission')
  assert.equal(classifyDataError('new row violates row-level security policy for table "accounts"'), 'permission')
  assert.match(describeDataError({ code: '42501', message: 'x' }, { action: 'save' }).message, /Sign in again/)
})

test('anything else gets a plain retry sentence and keeps the raw text', () => {
  const d = describeDataError({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }, { action: 'delete', entity: 'budget' })
  assert.equal(d.message, "Couldn't delete this budget. Try again.")
  assert.equal(d.detail, 'PGRST116 — JSON object requested, multiple (or no) rows returned')
})

test('the raw message never becomes the headline', () => {
  const raw = 'insert or update on table "transactions" violates foreign key constraint'
  const { error, errorDetail } = toResult({ code: '23503', message: raw }, { action: 'save' })
  assert.notEqual(error, raw)
  assert.ok(errorDetail.includes(raw))
})

test('withDetail keeps the raw text with the sentence, and passes on no error', () => {
  assert.equal(withDetail({ error: null }), null)
  assert.deepEqual(withDetail({ error: 'Not authenticated' }), { message: 'Not authenticated', detail: null })
  assert.deepEqual(withDetail(toResult('Failed to fetch', { action: 'save' })), {
    message: "Couldn't reach the server. Check your connection and try again. Nothing was changed.",
    detail: 'Failed to fetch',
  })
})
