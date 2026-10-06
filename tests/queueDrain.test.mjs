import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SERVER_CHECK_FAILED, discardFlagged, drainWith, exclusive, singleFlight } from '../src/lib/queueDrain.ts'
import { MAX_ATTEMPTS, describeConflict, editQueuedInsert, hasQueuedInsert, setResolvedReceipt } from '../src/lib/queueState.ts'
import { fakeClient } from './helpers/fakeSupabase.mjs'
import { NOW, depsFor, fakeLocks, fakeQueueStore, fakeReceipts, queueDeps, queued } from './helpers/fakeQueueStore.mjs'

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
  let reads = 0
  // The first read finds the row; it is deleted before the write, so the re-read finds nothing.
  const client = fakeClient((call) => (call.op === 'select' ? { data: reads++ === 0 ? { updated_at: OLD } : null } : { data: [] }))
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
    if (call.op === 'update') { written = true; return { data: [{ id: 'row-a', updated_at: NEWER }] } }
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
  assert.deepEqual(client.calls.at(-1).filters, { id: 'row-a', user_id: 'u', updated_at: OLD })
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
  await discardFlagged({ ...queueDeps(store), receipts }, 'x')
  assert.deepEqual(store.read().map((i) => i.id), ['y', 'p'])
  assert.deepEqual(removed, ['t9'])
})

test('keepTheirs with no id drops every flagged item, failed ones included, and keeps pending', async () => {
  const store = fakeQueueStore([queued({ id: 'f', status: 'failed' }), queued({ id: 'c', status: 'conflict' }), queued({ id: 'p' })])
  await discardFlagged({ ...queueDeps(store), receipts: fakeReceipts() })
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

// LED-193: a saved insert is reported once, so a card payment's statement steps run once.
test('onSynced hears each saved insert once and ignores updates and a throwing listener', async () => {
  const store = fakeQueueStore([
    queued({ id: 'i', operation: 'insert', rowId: undefined, payload: { id: 'tx-1', amount: 1 } }),
    queued({ id: 'u' }),
  ])
  const heard = []
  const deps = { ...depsFor(fakeClient(happy), store), onSynced: (item) => { heard.push(item.payload.id); throw new Error('listener failed') } }
  assert.equal(await drainWith(deps), 2)
  assert.deepEqual(heard, ['tx-1'])
  assert.deepEqual(store.read(), [])
})

test('onSynced is not called for an insert the database rejected', async () => {
  const store = fakeQueueStore([queued({ id: 'i', operation: 'insert', rowId: undefined, payload: { id: 'tx-1' } })])
  const heard = []
  const client = fakeClient(() => ({ error: { code: '23514', message: 'amount' } }))
  await drainWith({ ...depsFor(client, store), onSynced: (item) => heard.push(item.id) })
  assert.deepEqual(heard, [])
})

// LED-297: a queued update or delete applies only to the revision it was made against.
// A one-row server: an update or delete matches only while `updated_at` still equals the filter.
function revisionServer({ row = { id: 'row-a', updated_at: OLD, amount: 1 }, readFails = false, beforeWrite } = {}) {
  const server = { row, writes: 0 }
  server.client = fakeClient((call) => {
    if (call.op === 'select') return readFails ? { error: { message: 'timeout' } } : { data: server.row && { ...server.row } }
    beforeWrite?.(server)
    const matches = server.row && (call.filters.updated_at === undefined || call.filters.updated_at === server.row.updated_at)
    if (!matches) return { data: [] }
    server.writes++
    if (call.op === 'delete') { server.row = null; return { data: [{ id: 'row-a' }] } }
    server.row = { ...server.row, ...call.payload, updated_at: new Date(NOW + server.writes).toISOString() }
    return { data: [{ id: 'row-a', updated_at: server.row.updated_at }] }
  })
  return server
}

test('LED-297: an update is written in one request conditioned on its base revision', async () => {
  const server = revisionServer()
  const store = fakeQueueStore([queued({ baseRevision: OLD })])
  assert.equal(await drainWith(depsFor(server.client, store)), 1)
  assert.deepEqual(server.client.calls.map((c) => c.op), ['update'], 'no separate read before the write')
  assert.equal(server.client.calls[0].filters.updated_at, OLD)
  assert.equal(server.row.amount, 5)
})

test('LED-297: a stale cached revision is flagged edited with the server values, not written', async () => {
  const server = revisionServer({ row: { id: 'row-a', updated_at: NEWER, amount: 9 } })
  const store = fakeQueueStore([queued({ baseRevision: OLD })])
  assert.equal(await drainWith(depsFor(server.client, store)), 0)
  const [item] = store.read()
  assert.deepEqual([item.status, item.conflictKind], ['conflict', 'edited'])
  assert.equal(item.serverSnapshot.amount, 9)
  assert.equal(server.row.amount, 9)
})

test('LED-297: a write landing between the read and the update is not overwritten', async () => {
  // Queued before LED-297 (no revision): the read sees OLD, then another device saves first.
  const server = revisionServer({
    beforeWrite: (s) => { if (s.writes === 0 && s.row.amount === 1) s.row = { ...s.row, amount: 7, updated_at: NEWER } },
  })
  const store = fakeQueueStore([queued({})])
  assert.equal(await drainWith(depsFor(server.client, store)), 0)
  assert.equal(server.row.amount, 7)
  assert.deepEqual([store.read()[0].status, store.read()[0].conflictKind], ['conflict', 'edited'])
})

test('LED-297: a skewed client clock cannot hide a newer server edit', async () => {
  // The device clock is a day ahead: the item's timestamp is later than the server's edit.
  const server = revisionServer({ row: { id: 'row-a', updated_at: NEWER, amount: 9 } })
  const store = fakeQueueStore([queued({ baseRevision: OLD, timestamp: NOW + 86_400_000 })])
  const deps = { ...depsFor(server.client, store), now: () => NOW + 86_400_000 }
  assert.equal(await drainWith(deps), 0)
  assert.equal(server.row.amount, 9)
  assert.equal(store.read()[0].status, 'conflict')
})

test('LED-297: a skewed clock behind the server does not flag an unchanged row', async () => {
  const server = revisionServer()
  const store = fakeQueueStore([queued({ baseRevision: OLD, timestamp: NOW - 86_400_000 * 2 })])
  const deps = { ...depsFor(server.client, store), now: () => NOW - 86_400_000 }
  assert.equal(await drainWith(deps), 1)
  assert.equal(server.row.amount, 5)
})

test('LED-297: a failed check keeps the item pending with a retryable message and writes nothing', async () => {
  for (const item of [queued({}), queued({ operation: 'delete', payload: {} })]) {
    const server = revisionServer({ readFails: true })
    const store = fakeQueueStore([item])
    assert.equal(await drainWith(depsFor(server.client, store)), 0)
    const [kept] = store.read()
    assert.equal(kept.status, undefined)
    assert.equal(kept.lastError, SERVER_CHECK_FAILED)
    assert.equal(server.writes, 0)
  }
})

test('LED-297: a conditional write that matched nothing and cannot be re-read is kept, not flagged', async () => {
  const client = fakeClient((call) => (call.op === 'select' ? { error: { message: 'timeout' } } : { data: [] }))
  const store = fakeQueueStore([queued({ baseRevision: OLD })])
  assert.equal(await drainWith(depsFor(client, store)), 0)
  assert.equal(store.read()[0].status, undefined)
  assert.equal(store.read()[0].lastError, SERVER_CHECK_FAILED)
})

test('LED-297: a delete against a stale revision is a conflict; against a deleted row it is synced', async () => {
  const edited = revisionServer({ row: { id: 'row-a', updated_at: NEWER } })
  const store = fakeQueueStore([queued({ operation: 'delete', payload: {}, baseRevision: OLD })])
  assert.equal(await drainWith(depsFor(edited.client, store)), 0)
  assert.ok(edited.row, 'the edited row is not deleted')
  assert.equal(store.read()[0].conflictKind, 'edited')

  const deleted = revisionServer({ row: null })
  const store2 = fakeQueueStore([queued({ operation: 'delete', payload: {}, baseRevision: OLD })])
  assert.equal(await drainWith(depsFor(deleted.client, store2)), 1)
  assert.deepEqual(store2.read(), [])
})

test('LED-297: two edits made against the same revision both apply, in one drain or across two', async () => {
  const server = revisionServer()
  const store = fakeQueueStore([queued({ id: 'one', baseRevision: OLD }), queued({ id: 'two', payload: { amount: 6 }, baseRevision: OLD })])
  assert.equal(await drainWith(depsFor(server.client, store)), 2)
  assert.equal(server.row.amount, 6)

  // Across drains: the second edit's write is cut off by a dropped connection, then retried.
  const later = revisionServer()
  let drops = 1
  const flaky = {
    ...later.client,
    from(table) {
      const query = later.client.from(table)
      const update = query.update
      query.update = (payload) => {
        if (payload.amount === 6 && drops-- > 0) throw new Error('network')
        return update(payload)
      }
      return query
    },
  }
  const store2 = fakeQueueStore([queued({ id: 'one', baseRevision: OLD }), queued({ id: 'two', payload: { amount: 6 }, baseRevision: OLD })])
  assert.equal(await drainWith(depsFor(flaky, store2)), 1)
  assert.equal(store2.read()[0].baseRevision, later.row.updated_at, 'the kept edit moves onto our own write')
  assert.equal(await drainWith(depsFor(flaky, store2)), 1)
  assert.equal(later.row.amount, 6)
})

test('LED-297: keep mine is the only write without the revision condition', async () => {
  const server = revisionServer({ row: { id: 'row-a', updated_at: NEWER, amount: 9 } })
  const store = fakeQueueStore([queued({ baseRevision: OLD, force: true })])
  assert.equal(await drainWith(depsFor(server.client, store)), 1)
  assert.equal(server.client.calls[0].filters.updated_at, undefined)
  assert.equal(server.row.amount, 5)
})

// LED-298: a table of rows owned by users. Inserts honour the primary key; updates and deletes
// honour the revision filter. `lostResponse` commits an insert and then drops its response.
function tableServer({ rows = [], lostResponse = new Set() } = {}) {
  const server = { rows: new Map(rows.map((r) => [r.id, r])), clock: 0 }
  const stamp = () => new Date(NOW + ++server.clock).toISOString()
  server.client = fakeClient((call) => {
    const row = server.rows.get(call.filters.id)
    const visible = row && row.user_id === call.filters.user_id ? row : null
    if (call.op === 'select') return { data: visible && { ...visible } }
    if (call.op === 'insert') {
      if (server.rows.has(call.payload.id)) return { error: { code: '23505', message: 'duplicate key value violates unique constraint "transactions_pkey"' } }
      const saved = { ...call.payload, updated_at: stamp() }
      server.rows.set(saved.id, saved)
      if (lostResponse.delete(saved.id)) throw new Error('network')
      return { data: [{ id: saved.id, updated_at: saved.updated_at }] }
    }
    if (!visible || (call.filters.updated_at !== undefined && call.filters.updated_at !== visible.updated_at)) return { data: [] }
    if (call.op === 'delete') { server.rows.delete(visible.id); return { data: [{ id: visible.id }] } }
    const saved = { ...visible, ...call.payload, updated_at: stamp() }
    server.rows.set(saved.id, saved)
    return { data: [{ id: saved.id, updated_at: saved.updated_at }] }
  })
  return server
}
const queuedInsert = (id, o = {}) =>
  queued({ id: `q-${id}`, operation: 'insert', rowId: undefined, payload: { id, user_id: 'u', amount: 1 }, ...o })

test('LED-298: imported rows edited and deleted before sync reach the server under their own ids', async () => {
  const server = tableServer()
  let queue = [queuedInsert('tx-1'), queuedInsert('tx-2')]
  queue = editQueuedInsert(queue, 'tx-1', { amount: 9 }).queue
  assert.ok(hasQueuedInsert(queue, 'transactions', 'tx-2'), 'a delete of tx-2 is queued without a revision')
  queue.push(queued({ id: 'd', operation: 'delete', payload: {}, rowId: 'tx-2' }))
  const store = fakeQueueStore(queue)
  assert.equal(await drainWith(depsFor(server.client, store)), 3)
  assert.deepEqual([...server.rows.keys()], ['tx-1'])
  assert.equal(server.rows.get('tx-1').amount, 9)
  assert.deepEqual(store.read(), [])
  const del = server.client.calls.find((c) => c.op === 'delete')
  // tx-1 was stamped first, tx-2 second: the delete is conditioned on tx-2's insert revision.
  assert.equal(del.filters.updated_at, new Date(NOW + 2).toISOString())
})

test('LED-298: a committed insert whose response was lost is synced once on replay, not duplicated or failed', async () => {
  const server = tableServer({ lostResponse: new Set(['tx-1']) })
  const store = fakeQueueStore([queuedInsert('tx-1')])
  const heard = []
  const deps = { ...depsFor(server.client, store), onSynced: (item) => heard.push(item.payload.id) }
  assert.equal(await drainWith(deps), 0, 'the response was lost')
  assert.equal(store.read().length, 1)
  assert.equal(await drainWith(deps), 1)
  assert.equal(server.rows.size, 1)
  assert.deepEqual(store.read(), [])
  assert.deepEqual(heard, ['tx-1'], 'the follow-up runs once')
})

test("LED-298: a duplicate id on someone else's row is a genuine failure", async () => {
  const server = tableServer({ rows: [{ id: 'tx-1', user_id: 'other', updated_at: OLD }] })
  const store = fakeQueueStore([queuedInsert('tx-1')])
  assert.equal(await drainWith(depsFor(server.client, store)), 0)
  assert.equal(store.read()[0].attempts, 1)
  assert.equal(server.rows.get('tx-1').user_id, 'other')
})

test('LED-298: a change to a row whose insert has not been sent waits for it', async () => {
  const server = tableServer()
  const store = fakeQueueStore([
    queuedInsert('tx-1', { status: 'failed', attempts: MAX_ATTEMPTS }),
    queued({ id: 'd', operation: 'delete', payload: {}, rowId: 'tx-1' }),
  ])
  assert.equal(await drainWith(depsFor(server.client, store)), 0)
  assert.deepEqual(store.read().map((i) => i.id), ['q-tx-1', 'd'])
  assert.ok(!server.client.calls.some((c) => c.op === 'delete' || c.op === 'select'))
})

// LED-299: the drain confirms only the version of a queued create it sent.
test('LED-299: an amount changed while its insert is in flight is still queued, then reaches the database', async () => {
  const server = tableServer()
  const store = fakeQueueStore([queuedInsert('tx-1')])
  let paused = true
  const client = {
    ...server.client,
    from(table) {
      const query = server.client.from(table)
      const insert = query.insert
      query.insert = (payload) => {
        if (paused) {
          paused = false
          // The user fixes the amount while the original request is on the wire.
          store.write(editQueuedInsert(store.read(), 'tx-1', { amount: 42 }).queue)
        }
        return insert(payload)
      }
      return query
    },
  }
  assert.equal(await drainWith(depsFor(client, store)), 1)
  assert.equal(server.rows.get('tx-1').amount, 1, 'the request that was in flight saved the old amount')
  const [follow] = store.read()
  assert.deepEqual([follow.operation, follow.rowId, follow.payload], ['update', 'tx-1', { amount: 42 }])
  assert.equal(follow.baseRevision, server.rows.get('tx-1').updated_at, 'made against the revision the insert produced')

  assert.equal(await drainWith(depsFor(client, store)), 1)
  assert.equal(server.rows.get('tx-1').amount, 42)
  assert.deepEqual(store.read(), [])
})

test('LED-299: an edit made while a failing insert is in flight keeps the edited copy', async () => {
  const store = fakeQueueStore([queuedInsert('tx-1')])
  const client = fakeClient(() => {
    store.write(editQueuedInsert(store.read(), 'tx-1', { amount: 42 }).queue)
    return { error: { code: '23514', message: 'amount' } }
  })
  await drainWith(depsFor(client, store))
  const [item] = store.read()
  assert.deepEqual([item.operation, item.payload.amount, item.attempts], ['insert', 42, undefined])
})

test('LED-299: an insert sent at its current version leaves nothing behind', async () => {
  const server = tableServer()
  const store = fakeQueueStore([queuedInsert('tx-1', { version: 3 })])
  assert.equal(await drainWith(depsFor(server.client, store)), 1)
  assert.deepEqual(store.read(), [])
})

// LED-301: an uploaded receipt is recorded before the row is saved.
const receiptInsert = (o = {}) =>
  queuedInsert('tx-1', { payload: { id: 'tx-1', user_id: 'u', amount: 1, receipt_url: 'pending-receipt:t1' }, ...o })

test('LED-301: a receipt uploaded before a failed insert stays attached on retry, with no second upload', async () => {
  const removed = []
  const receipts = fakeReceipts({ files: { t1: { name: 'r.jpg' } }, removed })
  const server = tableServer()
  let fail = true
  const client = {
    ...server.client,
    from(table) {
      const query = server.client.from(table)
      const insert = query.insert
      query.insert = (payload) => {
        if (fail) { fail = false; throw new Error('network') }
        return insert(payload)
      }
      return query
    },
  }
  const store = fakeQueueStore([receiptInsert()])
  assert.equal(await drainWith(depsFor(client, store, receipts)), 0)
  // As after a reload: only what was stored survives.
  assert.equal(store.read()[0].payload.receipt_url, 'u/r.jpg')
  assert.deepEqual(removed, ['t1'], 'the local file goes once the path is stored')

  assert.equal(await drainWith(depsFor(client, store, receipts)), 1)
  assert.equal(server.rows.get('tx-1').receipt_url, 'u/r.jpg')
  assert.equal(client.uploads.length, 1)
})

test('LED-301: the local file is kept when the uploaded path cannot be stored', async () => {
  const removed = []
  const receipts = fakeReceipts({ files: { t1: { name: 'r.jpg' } }, removed })
  const store = fakeQueueStore([receiptInsert()])
  const deps = { ...depsFor(fakeClient(happy), store, receipts) }
  let writes = 0
  deps.mutateQueue = async (fn) => { if (writes++ === 0) throw new Error('QuotaExceededError'); return store.mutate(fn) }
  assert.equal(await drainWith(deps), 1)
  assert.deepEqual(removed, [])
})

test('LED-301: a receipt replaced while the old one uploaded removes the unused file and sends the new one after', async () => {
  const receipts = fakeReceipts({ files: { t1: { name: 'old.jpg' } } })
  const server = tableServer()
  const store = fakeQueueStore([receiptInsert()])
  const client = {
    ...server.client,
    storage: {
      from: (bucket) => {
        const b = server.client.storage.from(bucket)
        return {
          ...b,
          async upload(path, file) {
            store.write(editQueuedInsert(store.read(), 'tx-1', { receipt_url: 'pending-receipt:t2' }).queue)
            return b.upload(path, file)
          },
        }
      },
    },
  }
  assert.equal(await drainWith(depsFor(client, store, receipts)), 1)
  assert.deepEqual(server.client.removedFiles, [{ bucket: 'receipts', path: 'u/old.jpg' }])
  assert.equal(server.rows.get('tx-1').receipt_url, null)
  const [follow] = store.read()
  assert.deepEqual([follow.operation, follow.payload], ['update', { receipt_url: 'pending-receipt:t2' }])
})

test('LED-301: discarding an item whose receipt was uploaded deletes that file', async () => {
  const client = fakeClient(happy)
  const store = fakeQueueStore([receiptInsert({ status: 'failed', uploadedReceipt: 'u/r.jpg', payload: { id: 'tx-1', receipt_url: 'u/r.jpg' } })])
  await discardFlagged({ ...queueDeps(store), receipts: fakeReceipts(), client }, 'q-tx-1')
  assert.deepEqual(store.read(), [])
  assert.deepEqual(client.removedFiles, [{ bucket: 'receipts', path: 'u/r.jpg' }])
})

test('setResolvedReceipt applies only while the item still points at the same pending file', () => {
  const item = receiptInsert({ version: 2 })
  const { queue, applied } = setResolvedReceipt([item], 'q-tx-1', 'pending-receipt:t1', 'u/r.jpg')
  assert.equal(applied, true)
  assert.deepEqual([queue[0].payload.receipt_url, queue[0].uploadedReceipt, queue[0].version], ['u/r.jpg', 'u/r.jpg', 2])
  assert.equal(setResolvedReceipt([item], 'q-tx-1', 'pending-receipt:other', 'u/r.jpg').applied, false)
  assert.equal(setResolvedReceipt([], 'q-tx-1', 'pending-receipt:t1', 'u/r.jpg').applied, false)
})

// LED-300: a receipt is a job of its own, for an edit as much as a create.
test('LED-300: a receipt queued on an existing row uploads, then the row points at the uploaded path', async () => {
  // An online save whose upload failed: the row saved without it, and the receipt follows as an edit.
  const server = tableServer({ rows: [{ id: 'tx-1', user_id: 'u', amount: 1, receipt_url: null, updated_at: OLD }] })
  const removed = []
  const receipts = fakeReceipts({ files: { t1: { name: 'r.jpg' } }, removed })
  const store = fakeQueueStore([queued({ rowId: 'tx-1', payload: { receipt_url: 'pending-receipt:t1' }, baseRevision: OLD })])
  assert.equal(await drainWith(depsFor(server.client, store, receipts)), 1)
  assert.equal(server.client.uploads[0].path, 'u/r.jpg')
  assert.equal(server.rows.get('tx-1').receipt_url, 'u/r.jpg')
  assert.equal(server.client.calls.find((c) => c.op === 'update').filters.updated_at, OLD)
  assert.deepEqual(removed, ['t1'])
})

test('LED-300: an offline edit that attaches a receipt and changes the amount saves both', async () => {
  const server = tableServer({ rows: [{ id: 'tx-1', user_id: 'u', amount: 1, receipt_url: null, updated_at: OLD }] })
  const receipts = fakeReceipts({ files: { t1: { name: 'r.jpg' } } })
  const store = fakeQueueStore([queued({ rowId: 'tx-1', payload: { amount: 3, receipt_url: 'pending-receipt:t1' }, baseRevision: OLD })])
  assert.equal(await drainWith(depsFor(server.client, store, receipts)), 1)
  assert.deepEqual([server.rows.get('tx-1').amount, server.rows.get('tx-1').receipt_url], [3, 'u/r.jpg'])
})

test("LED-300: an edit's receipt that failed to upload waits; one whose file is gone leaves the row's receipt alone", async () => {
  const waiting = tableServer({ rows: [{ id: 'tx-1', user_id: 'u', receipt_url: 'u/old.jpg', updated_at: OLD }] })
  const store = fakeQueueStore([queued({ rowId: 'tx-1', payload: { receipt_url: 'pending-receipt:t1' }, baseRevision: OLD })])
  const failing = { ...waiting.client, storage: { from: () => ({ upload: async () => ({ error: { message: 'offline' } }), remove: async () => ({ error: null }) }) } }
  assert.equal(await drainWith(depsFor(failing, store, fakeReceipts({ files: { t1: { name: 'r.jpg' } } }))), 0)
  assert.equal(store.read()[0].payload.receipt_url, 'pending-receipt:t1')

  assert.equal(await drainWith(depsFor(waiting.client, store, fakeReceipts())), 1, 'the file is gone')
  assert.equal(waiting.rows.get('tx-1').receipt_url, 'u/old.jpg')
  assert.ok(!waiting.client.calls.some((c) => c.op === 'update'), 'nothing left to send')
})

test('LED-300: discarding a flagged edit drops its pending receipt file', async () => {
  const removed = []
  const store = fakeQueueStore([queued({ id: 'e', status: 'conflict', conflictKind: 'edited', payload: { receipt_url: 'pending-receipt:t3' } })])
  await discardFlagged({ ...queueDeps(store), receipts: fakeReceipts({ removed }) }, 'e')
  assert.deepEqual(removed, ['t3'])
})

test('LED-303: a change stored by another tab while the drain awaits the network survives the merge', async () => {
  const store = fakeQueueStore([queued({ id: 'first', operation: 'insert', rowId: undefined })])
  const client = fakeClient((call) => {
    // Another tab's transaction lands between this drain's read and its closing write.
    void store.mutate((q) => [...q, queued({ id: 'other-tab', timestamp: NOW })])
    return happy(call)
  })
  assert.equal(await drainWith(depsFor(client, store)), 1)
  assert.deepEqual(store.read().map((i) => i.id), ['other-tab'])
})

// Two tabs: one stored queue, one lock manager, and each tab's own single-flight drain.
function twoTabs(store, client, locks) {
  const tab = () => singleFlight((p) => exclusive(locks, 'ledger_queue_drain', () => drainWith(depsFor(client, store), p)))
  return [tab(), tab()]
}

test('LED-302: enqueues from two tabs at once are all kept', async () => {
  const store = fakeQueueStore()
  const add = (id) => store.mutate((q) => [...q, queued({ id, operation: 'insert', rowId: undefined, payload: { id: `row-${id}` } })])
  await Promise.all([add('tab-a-1'), add('tab-b-1'), add('tab-a-2'), add('tab-b-2')])
  assert.deepEqual(store.read().map((i) => i.id).sort(), ['tab-a-1', 'tab-a-2', 'tab-b-1', 'tab-b-2'])
})

test('LED-302: two tabs reconnecting at once send every item once', async () => {
  const store = fakeQueueStore([
    queued({ id: 'i1', operation: 'insert', rowId: undefined, payload: { id: 'row-1' } }),
    queued({ id: 'i2', operation: 'insert', rowId: undefined, payload: { id: 'row-2' } }),
    queued({ id: 'u1' }),
  ])
  const client = fakeClient(happy)
  const [a, b] = twoTabs(store, client, fakeLocks())
  const [sentA, sentB] = await Promise.all([a(), b()])
  assert.equal(sentA + sentB, 3)
  const writes = client.calls.filter((c) => c.op === 'insert' || c.op === 'update')
  assert.equal(writes.length, 3, 'no item is sent by both tabs')
  assert.deepEqual(store.read(), [])
})

test('LED-302: without Web Locks the drain still runs', async () => {
  const store = fakeQueueStore([queued({ id: 'i', operation: 'insert', rowId: undefined })])
  assert.equal(await exclusive(undefined, 'ledger_queue_drain', () => drainWith(depsFor(fakeClient(happy), store))), 1)
})
