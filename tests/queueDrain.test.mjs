import { test } from 'node:test'
import assert from 'node:assert/strict'
import { discardFlagged, drainWith, singleFlight } from '../src/lib/queueDrain.ts'
import { MAX_ATTEMPTS, describeConflict } from '../src/lib/queueState.ts'
import { fakeClient } from './helpers/fakeSupabase.mjs'
import { NOW, depsFor, fakeQueueStore, fakeReceipts, queued } from './helpers/fakeQueueStore.mjs'

const OLD = new Date(NOW - 10_000).toISOString()
const NEWER = new Date(NOW + 10_000).toISOString()
// A select for the conflict check finds an unchanged row; everything else succeeds.
const happy = (call) => (call.op === 'select' ? { data: { updated_at: OLD } } : call.op === 'update' ? { data: [{ id: 'row-a' }] } : {})

test('a clean queue drains and empties', async () => {
  const store = fakeQueueStore([queued({ id: 'i', operation: 'insert', rowId: undefined }), queued({ id: 'u' })])
  const client = fakeClient(happy)
  assert.equal(await drainWith(depsFor(client, store)), 2)
  assert.deepEqual(store.read(), [])
})

test('an item enqueued while the drain awaits the network is kept', async () => {
  const store = fakeQueueStore([queued({ id: 'first', operation: 'insert', rowId: undefined })])
  const client = fakeClient((call) => {
    store.write([...store.read(), queued({ id: 'late', timestamp: NOW })])
    return happy(call)
  })
  assert.equal(await drainWith(depsFor(client, store)), 1)
  assert.deepEqual(store.read().map((i) => i.id), ['late'])
})

test('a flagged item resolved with keep-theirs mid-drain stays removed', async () => {
  const store = fakeQueueStore([
    queued({ id: 'flagged', status: 'conflict', conflictKind: 'edited' }),
    queued({ id: 'p', operation: 'insert', rowId: undefined }),
  ])
  const client = fakeClient((call) => {
    store.write(store.read().filter((i) => i.id !== 'flagged'))
    return happy(call)
  })
  await drainWith(depsFor(client, store))
  assert.deepEqual(store.read(), [])
})

test('a flagged item resolved with keep-mine mid-drain is not overwritten by the drain copy', async () => {
  const store = fakeQueueStore([
    queued({ id: 'flagged', status: 'conflict', conflictKind: 'edited' }),
    queued({ id: 'p', operation: 'insert', rowId: undefined }),
  ])
  const client = fakeClient((call) => {
    store.write(store.read().map((i) => (i.id === 'flagged' ? { ...i, status: undefined, force: true } : i)))
    return happy(call)
  })
  await drainWith(depsFor(client, store))
  const [kept] = store.read()
  assert.equal(kept.id, 'flagged')
  assert.equal(kept.status, undefined)
  assert.equal(kept.force, true)
})

test('an update to a row deleted on the server becomes a conflict, not synced', async () => {
  const store = fakeQueueStore([queued({})])
  const client = fakeClient((call) => (call.op === 'select' ? { data: null } : happy(call)))
  assert.equal(await drainWith(depsFor(client, store)), 0)
  const [item] = store.read()
  assert.equal(item.status, 'conflict')
  assert.equal(item.conflictKind, 'deleted')
  assert.ok(!client.calls.some((c) => c.op === 'update'), 'no write is attempted against a missing row')
})

test('an update that touches zero rows is a deleted-row conflict even after the check passed', async () => {
  const store = fakeQueueStore([queued({})])
  const client = fakeClient((call) => (call.op === 'select' ? { data: { updated_at: OLD } } : { data: [] }))
  assert.equal(await drainWith(depsFor(client, store)), 0)
  assert.equal(store.read()[0].conflictKind, 'deleted')
})

test('an update to a row edited on the server keeps the server values for review', async () => {
  const store = fakeQueueStore([queued({ payload: { amount: 5, notes: 'mine' } })])
  const client = fakeClient((call) => (call.op === 'select' ? { data: { updated_at: NEWER, amount: 9, notes: 'mine' } } : happy(call)))
  await drainWith(depsFor(client, store))
  const [item] = store.read()
  assert.equal(item.status, 'conflict')
  assert.equal(item.conflictKind, 'edited')
  assert.deepEqual(describeConflict(item), [{ field: 'amount', mine: 5, theirs: 9 }])
  assert.equal(client.calls.find((c) => c.op === 'select').columns, 'updated_at,amount,notes')
})

test('force skips the conflict check', async () => {
  const store = fakeQueueStore([queued({ force: true })])
  const client = fakeClient(happy)
  assert.equal(await drainWith(depsFor(client, store)), 1)
  assert.ok(!client.calls.some((c) => c.op === 'select'))
})

test('a second edit to the same row in one drain is not flagged by our own first write', async () => {
  const store = fakeQueueStore([queued({ id: 'one' }), queued({ id: 'two', payload: { amount: 6 } })])
  // After the first write the server row looks newer than the queued items.
  let written = false
  const client = fakeClient((call) => {
    if (call.op === 'update') { written = true; return { data: [{ id: 'row-a' }] } }
    return { data: { updated_at: written ? NEWER : OLD } }
  })
  assert.equal(await drainWith(depsFor(client, store)), 2)
  assert.deepEqual(store.read(), [])
})

test('a delete of a row that is already gone counts as synced', async () => {
  const store = fakeQueueStore([queued({ operation: 'delete', payload: {} })])
  const client = fakeClient((call) => (call.op === 'select' ? { data: null } : {}))
  assert.equal(await drainWith(depsFor(client, store)), 1)
  assert.ok(!client.calls.some((c) => c.op === 'delete'))
  assert.deepEqual(store.read(), [])
})

test('a delete of a row edited on the server is a conflict', async () => {
  const store = fakeQueueStore([queued({ operation: 'delete', payload: {} })])
  const client = fakeClient((call) => (call.op === 'select' ? { data: { updated_at: NEWER } } : {}))
  assert.equal(await drainWith(depsFor(client, store)), 0)
  const [item] = store.read()
  assert.deepEqual([item.status, item.conflictKind], ['conflict', 'edited'])
  assert.ok(!client.calls.some((c) => c.op === 'delete'))
})

test('a delete with no conflict is sent', async () => {
  const store = fakeQueueStore([queued({ operation: 'delete', payload: {} })])
  const client = fakeClient((call) => (call.op === 'select' ? { data: { updated_at: OLD } } : {}))
  assert.equal(await drainWith(depsFor(client, store)), 1)
  assert.deepEqual(client.calls.at(-1).filters, { id: 'row-a', user_id: 'u' })
})

test('repeated database errors flag an insert as failed after the limit, then it is skipped', async () => {
  const store = fakeQueueStore([queued({ operation: 'insert', rowId: undefined })])
  const client = fakeClient(() => ({ error: { code: '23514', message: 'amount must be positive' } }))
  for (let i = 1; i < MAX_ATTEMPTS; i++) {
    await drainWith(depsFor(client, store))
    assert.equal(store.read()[0].status, undefined, `still pending after ${i} tries`)
    assert.equal(store.read()[0].attempts, i)
  }
  await drainWith(depsFor(client, store))
  const [item] = store.read()
  assert.equal(item.status, 'failed')
  assert.equal(item.lastError, 'amount must be positive')
  const before = client.calls.length
  await drainWith(depsFor(client, store))
  assert.equal(client.calls.length, before, 'a failed item is not retried automatically')
})

test('a dropped connection never counts toward the limit', async () => {
  const store = fakeQueueStore([queued({ operation: 'delete', payload: {} , force: true })])
  const client = fakeClient(() => ({ error: { code: '', message: 'TypeError: Failed to fetch' } }))
  for (let i = 0; i < MAX_ATTEMPTS + 2; i++) await drainWith(depsFor(client, store))
  const [item] = store.read()
  assert.equal(item.status, undefined)
  assert.equal(item.attempts, undefined)
})

test('a thrown error keeps the item for the next drain', async () => {
  const store = fakeQueueStore([queued({ operation: 'insert', rowId: undefined })])
  const client = fakeClient(() => { throw new Error('network') })
  assert.equal(await drainWith(depsFor(client, store)), 0)
  assert.equal(store.read().length, 1)
})

test('expired items are flagged, not sent', async () => {
  const store = fakeQueueStore([queued({ id: 'old', timestamp: 0 }), queued({ id: 'p', operation: 'insert', rowId: undefined })])
  const client = fakeClient(happy)
  assert.equal(await drainWith(depsFor(client, store)), 1)
  assert.deepEqual(store.read().map((i) => [i.id, i.status]), [['old', 'expired']])
})

test('progress is reported for each attempted item', async () => {
  const store = fakeQueueStore([queued({ id: 'a', operation: 'insert', rowId: undefined }), queued({ id: 'b', operation: 'insert', rowId: undefined })])
  const seen = []
  await drainWith(depsFor(fakeClient(happy), store), (done, total) => seen.push([done, total]))
  assert.deepEqual(seen, [[1, 2], [2, 2]])
})

test('a queued receipt is uploaded, then the insert points at the uploaded path', async () => {
  const removed = []
  const receipts = fakeReceipts({ files: { t1: { name: 'r.jpg' } }, removed })
  const store = fakeQueueStore([queued({ operation: 'insert', rowId: undefined, payload: { receipt_url: 'pending-receipt:t1' } })])
  const client = fakeClient(happy)
  assert.equal(await drainWith(depsFor(client, store, receipts)), 1)
  assert.equal(client.uploads[0].path, 'u/r.jpg')
  assert.equal(client.calls.find((c) => c.op === 'insert').payload.receipt_url, 'u/r.jpg')
  assert.deepEqual(removed, ['t1'])
})

test('a failed receipt upload keeps the item and does not insert', async () => {
  const receipts = fakeReceipts({ files: { t1: { name: 'r.jpg' } } })
  const store = fakeQueueStore([queued({ operation: 'insert', rowId: undefined, payload: { receipt_url: 'pending-receipt:t1' } })])
  const client = fakeClient(happy, { upload: () => ({ message: 'offline' }) })
  assert.equal(await drainWith(depsFor(client, store, receipts)), 0)
  assert.equal(store.read().length, 1)
  assert.ok(!client.calls.some((c) => c.op === 'insert'))
})

test('a receipt file that is missing inserts without a receipt', async () => {
  const store = fakeQueueStore([queued({ operation: 'insert', rowId: undefined, payload: { receipt_url: 'pending-receipt:gone' } })])
  const client = fakeClient(happy)
  assert.equal(await drainWith(depsFor(client, store)), 1)
  assert.equal(client.calls.find((c) => c.op === 'insert').payload.receipt_url, null)
})

test('keepTheirs drops the flagged item and its pending receipt file', async () => {
  const removed = []
  const receipts = fakeReceipts({ removed })
  const store = fakeQueueStore([
    queued({ id: 'x', status: 'expired', operation: 'insert', rowId: undefined, payload: { receipt_url: 'pending-receipt:t9' } }),
    queued({ id: 'y', status: 'conflict' }),
    queued({ id: 'p' }),
  ])
  await discardFlagged({ readQueue: store.read, writeQueue: store.write, receipts }, 'x')
  assert.deepEqual(store.read().map((i) => i.id), ['y', 'p'])
  assert.deepEqual(removed, ['t9'])
})

test('keepTheirs with no id drops every flagged item, failed ones included, and keeps pending', async () => {
  const store = fakeQueueStore([queued({ id: 'f', status: 'failed' }), queued({ id: 'c', status: 'conflict' }), queued({ id: 'p' })])
  await discardFlagged({ readQueue: store.read, writeQueue: store.write, receipts: fakeReceipts() })
  assert.deepEqual(store.read().map((i) => i.id), ['p'])
})

test('a second drain started while one is running shares it and replays nothing twice', async () => {
  const store = fakeQueueStore([queued({ operation: 'insert', rowId: undefined })])
  const client = fakeClient(async () => { await new Promise((r) => setTimeout(r, 5)); return {} })
  const drain = singleFlight((onProgress) => drainWith(depsFor(client, store), onProgress))
  const [a, b] = await Promise.all([drain(), drain()])
  assert.equal(a, 1)
  assert.equal(b, 1)
  assert.equal(client.calls.filter((c) => c.op === 'insert').length, 1)
  assert.equal(await drain(), 0, 'a later drain runs again once the first has finished')
})
