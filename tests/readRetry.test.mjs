import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FIRST_LOAD_RETRY_MS, readWithPolicy } from '../src/lib/readRetry.ts'

// What supabase-js returns when fetch itself fails (a blocked or dropped request).
const offline = { data: null, error: { message: 'TypeError: Failed to fetch', code: '' } }
const ok = { data: [{ id: 'a' }], error: null }

function reads(...results) {
  const calls = []
  const run = async (retry) => {
    calls.push(retry)
    return results[Math.min(calls.length - 1, results.length - 1)]
  }
  return { run, calls }
}

function sleeps() {
  const waits = []
  return { sleep: async (ms) => { waits.push(ms) }, waits }
}

test('a first load that cannot connect tries once more without library retries, then shows the error', async () => {
  const { run, calls } = reads(offline)
  const { sleep, waits } = sleeps()
  const result = await readWithPolicy(run, { background: false, sleep })
  assert.deepEqual(calls, [false, false])
  assert.deepEqual(waits, [FIRST_LOAD_RETRY_MS])
  assert.equal(result, offline)
  assert.ok(FIRST_LOAD_RETRY_MS <= 1000, 'the whole wait stays near 2 s with two failed requests')
})

test('a first load that connects on the second try returns its data, so the error clears', async () => {
  const { run, calls } = reads(offline, ok)
  const result = await readWithPolicy(run, { background: false, sleep: async () => {} })
  assert.deepEqual(calls, [false, false])
  assert.equal(result, ok)
})

test('a first load that succeeds reads once', async () => {
  const { run, calls } = reads(ok)
  assert.equal(await readWithPolicy(run, { background: false, sleep: async () => {} }), ok)
  assert.deepEqual(calls, [false])
})

test('a refused read is not retried: retrying would not help', async () => {
  for (const error of [{ code: '42501', message: 'permission denied for table accounts' }, { code: 'PGRST100', message: 'bad filter' }]) {
    const { run, calls } = reads({ data: null, error })
    const { sleep, waits } = sleeps()
    await readWithPolicy(run, { background: false, sleep })
    assert.deepEqual(calls, [false], error.code)
    assert.deepEqual(waits, [])
  }
})

test('a background refresh keeps the library retries and is not retried again on top', async () => {
  const { run, calls } = reads(offline)
  const { sleep, waits } = sleeps()
  await readWithPolicy(run, { background: true, sleep })
  assert.deepEqual(calls, [true])
  assert.deepEqual(waits, [])
})

test('a paged read that keeps only the message string is still seen as a connection failure', async () => {
  const { run, calls } = reads({ rows: [], error: 'TypeError: Failed to fetch' })
  await readWithPolicy(run, { background: false, sleep: async () => {} })
  assert.deepEqual(calls, [false, false])
})
