import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveLoadState } from '../src/lib/loadState.ts'

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
