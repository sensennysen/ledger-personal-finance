import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dedupeAsync } from '../src/lib/inFlightRequest.ts'

test('concurrent calls with the same key share one underlying call', async () => {
  let calls = 0
  const run = () => {
    calls++
    return new Promise((resolve) => setTimeout(() => resolve('rows'), 0))
  }
  const [a, b] = await Promise.all([dedupeAsync('key', run), dedupeAsync('key', run)])
  assert.equal(calls, 1)
  assert.equal(a, 'rows')
  assert.equal(b, 'rows')
})

test('different keys never share a call', async () => {
  let calls = 0
  const run = () => {
    calls++
    return Promise.resolve(calls)
  }
  const [a, b] = await Promise.all([dedupeAsync('one', run), dedupeAsync('two', run)])
  assert.equal(calls, 2)
  assert.notEqual(a, b)
})

test('a rejected call clears the key so the next call retries against the network', async () => {
  let calls = 0
  const run = () => {
    calls++
    return calls === 1 ? Promise.reject(new Error('boom')) : Promise.resolve('ok')
  }
  await assert.rejects(dedupeAsync('key', run))
  const result = await dedupeAsync('key', run)
  assert.equal(result, 'ok')
  assert.equal(calls, 2)
})

test('a settled call clears the key so a later call reads fresh instead of replaying it', async () => {
  let calls = 0
  const run = () => {
    calls++
    return Promise.resolve(calls)
  }
  const first = await dedupeAsync('key', run)
  const second = await dedupeAsync('key', run)
  assert.equal(first, 1)
  assert.equal(second, 2)
  assert.equal(calls, 2)
})
