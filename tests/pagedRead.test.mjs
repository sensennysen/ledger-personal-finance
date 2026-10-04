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

test('totals over more than 1,000 rows count every row', async () => {
  const total = 2500
  const fetchPage = async (from, to) => {
    const rows = []
    for (let i = from; i <= to && i < total; i++) rows.push({ id: i, amount: 2 })
    return { data: rows, error: null }
  }
  const { rows, error } = await readAllPages(fetchPage)
  assert.equal(error, null)
  assert.equal(rows.reduce((sum, row) => sum + row.amount, 0), total * 2)
})

test('a failed later page returns the error so the caller can refuse a partial list', async () => {
  let n = 0
  const fetchPage = async () => {
    n++
    return n === 3 ? { data: null, error: { message: 'boom' } } : { data: Array(1000).fill(0), error: null }
  }
  const { rows, error } = await readAllPages(fetchPage)
  assert.equal(error, 'boom')
  assert.equal(rows.length, 2000)
  assert.equal(n, 3)
})

test('a cancelled read stops after the current page instead of paging on', async () => {
  const { fetchPage, calls } = table(5000)
  let stale = false
  const { rows, error } = await readAllPages(
    async (from, to) => {
      const page = await fetchPage(from, to)
      if (calls.length === 2) stale = true
      return page
    },
    1000,
    () => stale,
  )
  assert.equal(error, null)
  assert.equal(calls.length, 2)
  assert.equal(rows.length, 1000)
})

test('a cancel check that is never true reads everything', async () => {
  const { fetchPage } = table(2100)
  const { rows } = await readAllPages(fetchPage, 1000, () => false)
  assert.equal(rows.length, 2100)
})

test('a page error that arrives after cancellation is dropped, not reported', async () => {
  const { rows, error } = await readAllPages(
    async () => ({ data: null, error: { message: 'late' } }),
    10,
    () => true,
  )
  assert.equal(error, null)
  assert.deepEqual(rows, [])
})
