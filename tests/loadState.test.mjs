import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveLoadState, resolveRefresh } from '../src/lib/loadState.ts'

const s = (loading, error, hasData) => resolveLoadState({ loading, error, hasData })

test('first load with nothing yet is loading', () => {
  assert.equal(s(true, null, false), 'loading')
})

test('failed read with nothing to show is an error, never empty', () => {
  assert.equal(s(false, 'Failed to fetch', false), 'error')
})

test('failed read while loading still surfaces the error', () => {
  assert.equal(s(true, 'Failed to fetch', false), 'error')
})

test('failed refetch with data on screen is a non-blocking stale-error', () => {
  assert.equal(s(false, 'Failed to fetch', true), 'stale-error')
})

test('loaded with no rows is empty', () => {
  assert.equal(s(false, null, false), 'empty')
})

test('refetch with cached data stays ready', () => {
  assert.equal(s(true, null, true), 'ready')
  assert.equal(s(false, null, true), 'ready')
})

const r = (loading, hasData, dataKey, requestedKey) =>
  resolveRefresh({ loading, hasData, dataKey, requestedKey })

test('loading a new key with the old key on screen is a refresh, named by the new key', () => {
  assert.deepEqual(r(true, true, '2026-09', '2026-10'), { refreshing: true, pendingKey: '2026-10' })
})

test('refetching the key already on screen is not a refresh', () => {
  assert.deepEqual(r(true, true, '2026-10', '2026-10'), { refreshing: false, pendingKey: null })
})

test('first load with nothing on screen is not a refresh', () => {
  assert.deepEqual(r(true, false, null, '2026-10'), { refreshing: false, pendingKey: null })
})

test('once the new key has loaded the refresh ends', () => {
  assert.deepEqual(r(false, true, '2026-10', '2026-10'), { refreshing: false, pendingKey: null })
})
