import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_QUEUE_AGE_MS, markExpired, applyKeepMine, removeFlagged, isPending, isFlagged,
  mergeDrainResult, rowKey,
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
