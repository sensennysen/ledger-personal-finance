import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_QUEUE_AGE_MS, MAX_ATTEMPTS, markExpired, applyKeepMine, removeFlagged, isPending, isFlagged,
  mergeDrainResult, rowKey, expireNow, nextExpiryAt, isCountableError, recordFailure, retryFailed,
  describeConflict, canKeepMine,
} from '../src/lib/queueState.ts'

const NOW = 1_000_000_000_000
const item = (o) => ({ id: 'a', table: 't', operation: 'update', payload: {}, userId: 'u', timestamp: NOW, ...o })

test('old items are flagged expired, not dropped', () => {
  const q = markExpired([item({ id: 'old', timestamp: NOW - MAX_QUEUE_AGE_MS - 1 }), item({ id: 'new' })], NOW)
  assert.equal(q.length, 2)
  assert.equal(q[0].status, 'expired')
  assert.equal(q[1].status, undefined)
})

test('existing conflict status is not overwritten by expiry', () => {
  const q = markExpired([item({ status: 'conflict', timestamp: 0 })], NOW)
  assert.equal(q[0].status, 'conflict')
})

test('pending vs flagged predicates', () => {
  assert.ok(isPending(item({})) && !isFlagged(item({})))
  assert.ok(isFlagged(item({ status: 'conflict' })) && !isPending(item({ status: 'expired' })))
})

test('keep mine clears status, forces, and restamps', () => {
  const [r] = applyKeepMine([item({ status: 'conflict', timestamp: 5 })], 'a', NOW)
  assert.deepEqual([r.status, r.force, r.timestamp], [undefined, true, NOW])
})

test('keep mine ignores unflagged and unknown ids', () => {
  const q = [item({})]
  assert.deepEqual(applyKeepMine(q, 'a', NOW), q)
  assert.deepEqual(applyKeepMine(q, 'zzz', NOW), q)
})

test('removeFlagged removes one or all flagged, never pending', () => {
  const q = [item({ id: '1', status: 'conflict' }), item({ id: '2', status: 'expired' }), item({ id: '3' })]
  assert.deepEqual(removeFlagged(q, '1').kept.map((i) => i.id), ['2', '3'])
  const all = removeFlagged(q)
  assert.deepEqual(all.kept.map((i) => i.id), ['3'])
  assert.equal(all.removed.length, 2)
})

test('rowKey distinguishes tables and rows', () => {
  assert.equal(rowKey(item({ table: 'a', rowId: '1' })), 'a:1')
  assert.notEqual(rowKey(item({ table: 'a', rowId: '1' })), rowKey(item({ table: 'b', rowId: '1' })))
})

test('merge keeps items enqueued during the drain', () => {
  const mid = item({ id: 'new' })
  const out = mergeDrainResult([item({ id: 'f' })], [item({ id: 'f' }), mid], new Set(['f']), new Set())
  assert.deepEqual(out.map((i) => i.id), ['f', 'new'])
})

test('merge drops items resolved (keep theirs / cleared) during the drain', () => {
  const flagged = item({ id: 'c', status: 'conflict' })
  assert.deepEqual(mergeDrainResult([flagged], [], new Set(['c']), new Set(['c'])), [])
})

test('merge prefers the current copy of items flagged at drain start (keep mine mid-drain)', () => {
  const start = item({ id: 'c', status: 'conflict' })
  const resolved = item({ id: 'c', force: true })
  const [out] = mergeDrainResult([start], [resolved], new Set(['c']), new Set(['c']))
  assert.equal(out.force, true)
  assert.equal(out.status, undefined)
})

test('merge keeps the drain result for items flagged by the drain itself', () => {
  const conflicted = item({ id: 'p', status: 'conflict' })
  const [out] = mergeDrainResult([conflicted], [item({ id: 'p' })], new Set(['p']), new Set())
  assert.equal(out.status, 'conflict')
})

test('expireNow flags on the clock and returns the same array when nothing changed', () => {
  const q = [item({ id: 'old', timestamp: NOW - MAX_QUEUE_AGE_MS - 1 }), item({ id: 'new' })]
  const next = expireNow(q, NOW)
  assert.equal(next[0].status, 'expired')
  assert.equal(next[1], q[1])
  const quiet = [item({ id: 'new' })]
  assert.equal(expireNow(quiet, NOW), quiet)
})

test('nextExpiryAt is the oldest pending item plus the limit, ignoring flagged ones', () => {
  assert.equal(nextExpiryAt([]), null)
  assert.equal(nextExpiryAt([item({ status: 'conflict', timestamp: 1 })]), null)
  const q = [item({ id: 'b', timestamp: NOW }), item({ id: 'a', timestamp: NOW - 5 })]
  assert.equal(nextExpiryAt(q), NOW - 5 + MAX_QUEUE_AGE_MS + 1)
  // At that moment expireNow flags it, so a timer set for it does not spin.
  assert.equal(expireNow(q, nextExpiryAt(q))[1].status, 'expired')
})

test('only a database error with a code counts as a failed attempt', () => {
  assert.equal(isCountableError({ code: '23505', message: 'dup' }), true)
  assert.equal(isCountableError({ code: '', message: 'TypeError: Failed to fetch' }), false)
  assert.equal(isCountableError(null), false)
  assert.equal(isCountableError(new Error('x')), false)
})

test('recordFailure counts, flags at the limit, and leaves a network failure alone', () => {
  const base = item({})
  assert.equal(recordFailure(base, 'x', false), base)
  let cur = base
  for (let i = 1; i < MAX_ATTEMPTS; i++) cur = recordFailure(cur, 'boom', true)
  assert.deepEqual([cur.attempts, cur.status, cur.lastError], [MAX_ATTEMPTS - 1, undefined, 'boom'])
  cur = recordFailure(cur, 'boom', true)
  assert.equal(cur.status, 'failed')
  assert.ok(isFlagged(cur) && !isPending(cur))
})

test('retryFailed makes a failed item pending with a fresh count and leaves others alone', () => {
  const q = [item({ id: 'f', status: 'failed', attempts: 5, lastError: 'x' }), item({ id: 'c', status: 'conflict' })]
  const [f, c] = retryFailed(q, 'f')
  assert.deepEqual([f.status, f.attempts, f.lastError], [undefined, undefined, undefined])
  assert.equal(retryFailed(q, 'c')[1], q[1])
  assert.equal(c.status, 'conflict')
})

test('describeConflict lists only the fields that differ, and nothing for a deleted row', () => {
  const edited = item({
    status: 'conflict', conflictKind: 'edited',
    payload: { amount: 5, notes: 'same', tags: ['a'] },
    serverSnapshot: { updated_at: 'x', amount: 9, notes: 'same', tags: ['b'] },
  })
  assert.deepEqual(describeConflict(edited), [
    { field: 'amount', mine: 5, theirs: 9 },
    { field: 'tags', mine: ['a'], theirs: ['b'] },
  ])
  assert.deepEqual(describeConflict({ ...edited, conflictKind: 'deleted' }), [])
  assert.deepEqual(describeConflict(item({})), [])
})

test('an update to a deleted row can only be discarded; keep mine clears the conflict details', () => {
  assert.equal(canKeepMine(item({ status: 'conflict', conflictKind: 'deleted' })), false)
  assert.equal(canKeepMine(item({ status: 'conflict', conflictKind: 'edited' })), true)
  assert.equal(canKeepMine(item({ status: 'failed' })), true)
  const [r] = applyKeepMine([item({ status: 'failed', attempts: 5, lastError: 'x', conflictKind: 'edited', serverSnapshot: {} })], 'a', NOW)
  assert.deepEqual([r.attempts, r.lastError, r.conflictKind, r.serverSnapshot], [undefined, undefined, undefined, undefined])
})

// LED-193: fixing a card payment that is still in the queue.
test('an edit of a queued create changes its payload, not a new update', async () => {
  const { editQueuedInsert } = await import('../src/lib/queueState.ts')
  const create = item({
    id: 'q1', table: 'transactions', operation: 'insert', label: 'Card',
    payload: { id: 'tx-1', user_id: 'u', type: 'transfer', to_account_id: 'card', amount: 100, date: '2026-09-01' },
  })
  const other = item({ id: 'q2', table: 'transactions', operation: 'update', rowId: 'tx-9', payload: { amount: 5 } })
  const { queue, edited } = editQueuedInsert([create, other], 'tx-1', { amount: 120, description: 'Card fixed' })
  assert.equal(edited, true)
  assert.equal(queue.length, 2)
  assert.deepEqual(queue[0].payload, { id: 'tx-1', user_id: 'u', type: 'transfer', to_account_id: 'card', amount: 120, date: '2026-09-01', description: 'Card fixed' })
  assert.equal(queue[0].label, 'Card fixed')
  assert.equal(queue[1], other)
})

test('fixing a failed queued create makes it pending again; flagged conflicts and unknown rows are left alone', async () => {
  const { editQueuedInsert } = await import('../src/lib/queueState.ts')
  const failed = item({
    id: 'q1', table: 'transactions', operation: 'insert', status: 'failed', attempts: 5, lastError: 'bad',
    payload: { id: 'tx-1', user_id: 'u', amount: -1 },
  })
  const fixed = editQueuedInsert([failed], 'tx-1', { amount: 10 })
  assert.equal(fixed.edited, true)
  assert.equal(fixed.queue[0].status, undefined)
  assert.equal(fixed.queue[0].attempts, undefined)
  assert.equal(fixed.queue[0].lastError, undefined)
  assert.equal(fixed.queue[0].payload.amount, 10)

  const conflict = item({ id: 'q3', table: 'transactions', operation: 'insert', status: 'expired', payload: { id: 'tx-3' } })
  assert.equal(editQueuedInsert([conflict], 'tx-3', { amount: 1 }).edited, false)
  assert.equal(editQueuedInsert([failed], 'nope', { amount: 1 }).edited, false)
})

test('an edit cannot move a queued create to another user or id', async () => {
  const { editQueuedInsert } = await import('../src/lib/queueState.ts')
  const create = item({ id: 'q1', table: 'transactions', operation: 'insert', payload: { id: 'tx-1', user_id: 'u' } })
  const { queue } = editQueuedInsert([create], 'tx-1', { id: 'other', user_id: 'someone-else', amount: 3 })
  assert.equal(queue[0].payload.id, 'tx-1')
  assert.equal(queue[0].payload.user_id, 'u')
})
