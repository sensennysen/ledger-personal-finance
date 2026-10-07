import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chunkIds, readInBatches } from '../src/lib/idBatches.ts'

const ids = (n) => Array.from({ length: n }, (_, i) => `id-${i}`)

test('chunks at the size boundary', () => {
  assert.deepEqual(chunkIds(ids(0), 2), [])
  assert.deepEqual(chunkIds(ids(4), 2).map((b) => b.length), [2, 2])
  assert.deepEqual(chunkIds(ids(5), 2).map((b) => b.length), [2, 2, 1])
  assert.equal(chunkIds(ids(401)).length, 3)
})

test('every row is read exactly once, in order', async () => {
  const all = ids(1001)
  const seen = []
  const result = await readInBatches([...all, 'id-3'], async (batch) => {
    seen.push(batch.length)
    return { rows: batch.map((id) => ({ id })), error: null }
  })
  assert.equal(result.error, null)
  assert.deepEqual(result.rows.map((r) => r.id), all)
  assert.deepEqual(seen, [200, 200, 200, 200, 200, 1])
})

test('the first error stops the read and is returned', async () => {
  let calls = 0
  const result = await readInBatches(ids(500), async (batch) => {
    calls++
    return calls === 2 ? { rows: [], error: 'boom' } : { rows: batch, error: null }
  })
  assert.equal(result.error, 'boom')
  assert.equal(calls, 2)
})

test('no ids makes no request', async () => {
  let calls = 0
  assert.deepEqual(await readInBatches([], async () => { calls++; return { rows: [], error: null } }), { rows: [], error: null })
  assert.equal(calls, 0)
})
