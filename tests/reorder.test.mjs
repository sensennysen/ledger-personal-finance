import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeSubsetOrder, moveAnnouncement, moveId, reorderIds } from '../src/lib/reorder.ts'

const ids = ['a', 'b', 'c', 'd']

test('a drop moves the dragged id to the target position', () => {
  assert.deepEqual(reorderIds(ids, 'a', 'c'), ['b', 'c', 'a', 'd'])
  assert.deepEqual(reorderIds(ids, 'd', 'b'), ['a', 'd', 'b', 'c'])
})

test('a drop on itself or an unknown id changes nothing and keeps the array', () => {
  assert.equal(reorderIds(ids, 'b', 'b'), ids)
  assert.equal(reorderIds(ids, 'x', 'b'), ids)
})

test('move up and down swap with the neighbour; the ends stay put', () => {
  assert.deepEqual(moveId(ids, 'b', -1), ['b', 'a', 'c', 'd'])
  assert.deepEqual(moveId(ids, 'b', 1), ['a', 'c', 'b', 'd'])
  assert.equal(moveId(ids, 'a', -1), ids)
  assert.equal(moveId(ids, 'd', 1), ids)
})

test('a reordered tab is merged back without moving the categories outside it', () => {
  // 'x' and 'y' are on another tab.
  assert.deepEqual(mergeSubsetOrder(['a', 'x', 'b', 'y', 'c'], ['c', 'a', 'b']), ['c', 'x', 'a', 'y', 'b'])
})

test('the announcement gives the 1-based position in the visible list', () => {
  assert.equal(moveAnnouncement('Groceries', ['b', 'a', 'c'], 'a'), 'Groceries moved to position 2 of 3.')
})
