import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RETRY_DELAYS_MS, retryDelay, shouldDrain } from '../src/lib/syncReadiness.ts'

const base = { ready: true, online: true, pending: 2, syncing: false }

test('LED-305: the app drains on opening online with items waiting', () => {
  assert.equal(shouldDrain(base), true)
})

test('LED-305: no drain before the queue is open, offline, with nothing pending, or while one runs', () => {
  assert.equal(shouldDrain({ ...base, ready: false }), false)
  assert.equal(shouldDrain({ ...base, online: false }), false)
  assert.equal(shouldDrain({ ...base, pending: 0 }), false)
  assert.equal(shouldDrain({ ...base, syncing: true }), false)
})

test('LED-305: automatic retries are bounded and wait longer each time', () => {
  const delays = RETRY_DELAYS_MS.map((_, i) => retryDelay(i))
  assert.deepEqual(delays, [5_000, 30_000, 120_000])
  assert.ok(delays.every((d, i) => i === 0 || d > delays[i - 1]))
  assert.equal(retryDelay(RETRY_DELAYS_MS.length), null)
})
