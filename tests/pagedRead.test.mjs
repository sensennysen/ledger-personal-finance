import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readAllPages } from '../src/lib/pagedRead.ts'

// A fake table that answers range requests like PostgREST.
const table = (total) => {
  const calls = []
  const fetchPage = async (from, to) => {
    calls.push([from, to])
    const rows = []
    for (let i = from; i <= to && i < total; i++) rows.push(i)
    return { data: rows, error: null }
  }
  return { fetchPage, calls }
}

test('empty table reads one page', async () => {
  const { fetchPage, calls } = table(0)
  assert.deepEqual(await readAllPages(fetchPage, 10), { rows: [], error: null })
  assert.equal(calls.length, 1)
})

test('exactly one full page needs a second, empty read', async () => {
  const { fetchPage, calls } = table(10)
  const { rows, error } = await readAllPages(fetchPage, 10)
  assert.equal(error, null)
  assert.equal(rows.length, 10)
  assert.deepEqual(calls, [[0, 9], [10, 19]])
})

test('reads past the page size without gaps or repeats', async () => {
  const { fetchPage, calls } = table(2350)
  const { rows, error } = await readAllPages(fetchPage)
  assert.equal(error, null)
  assert.equal(rows.length, 2350)
  assert.deepEqual(rows, Array.from({ length: 2350 }, (_, i) => i))
  assert.deepEqual(calls, [[0, 999], [1000, 1999], [2000, 2999]])
})

test('an error on a later page stops and is returned', async () => {
  let n = 0
  const fetchPage = async () => {
    n++
    if (n === 2) return { data: null, error: { message: 'timeout' } }
    return { data: Array(10).fill(0), error: null }
  }
  const { rows, error } = await readAllPages(fetchPage, 10)
  assert.equal(error, 'timeout')
  assert.equal(rows.length, 10)
  assert.equal(n, 2)
})

test('null data ends the read', async () => {
  const { rows, error } = await readAllPages(async () => ({ data: null, error: null }), 10)
  assert.deepEqual({ rows, error }, { rows: [], error: null })
})
