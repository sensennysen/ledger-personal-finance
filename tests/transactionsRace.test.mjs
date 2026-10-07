import { test } from 'node:test'
import assert from 'node:assert/strict'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { entityKey, entityQueryOptions } from '../src/lib/entityQuery.ts'
import { readAllPages } from '../src/lib/pagedRead.ts'

// LED-304: changing filters quickly shows only the latest filter's rows, loading and errors.

function memoryCache() {
  const store = new Map()
  return { store, read: (k) => store.get(k) ?? null, write: (k, d) => { store.set(k, d); return true } }
}

function deferred() {
  let resolve
  const promise = new Promise((r) => { resolve = r })
  return { promise, resolve }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

function options(filter, read, cache) {
  return entityQueryOptions({
    queryKey: entityKey('u1', 'transactions', { categoryId: filter }),
    cacheKey: `u1:transactions:${filter}`,
    read,
    cache,
  })
}

test('a slow read for filter A released after filter B never shows under B', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, networkMode: 'always' } } })
  const cache = memoryCache()
  const gateA = deferred()
  const readA = async () => { await gateA.promise; return { data: [{ id: 'a-row' }], error: null } }
  const readB = async () => ({ data: [{ id: 'b-row' }], error: null })

  const observer = new QueryObserver(qc, options('A', readA, cache))
  const seen = []
  const off = observer.subscribe((r) => seen.push(r))
  await tick()
  assert.equal(observer.getCurrentResult().isPending, true)

  // The user picks filter B while A is still reading.
  observer.setOptions(options('B', readB, cache))
  await tick()
  await tick()
  assert.deepEqual(observer.getCurrentResult().data, [{ id: 'b-row' }])
  assert.equal(observer.getCurrentResult().isPending, false)

  // A comes back late: it is not what B shows, and B's loading state is not touched.
  gateA.resolve()
  await tick()
  await tick()
  const now = observer.getCurrentResult()
  assert.deepEqual(now.data, [{ id: 'b-row' }])
  assert.equal(now.isFetching, false)
  assert.equal(now.error, null)
  assert.ok(!seen.slice(seen.findIndex((r) => r.data?.[0]?.id === 'b-row')).some((r) => r.data?.[0]?.id === 'a-row'))
  assert.equal(cache.store.get('u1:transactions:A'), undefined, 'a read nobody waits for is cancelled, so its copy is not written')
  off()
})

test("A's error after moving to B is not shown under B", async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, networkMode: 'always' } } })
  const cache = memoryCache()
  const gateA = deferred()
  const readA = async () => { await gateA.promise; return { data: null, error: { code: '42501', message: 'permission denied' } } }
  const readB = async () => ({ data: [{ id: 'b-row' }], error: null })

  const observer = new QueryObserver(qc, options('A', readA, cache))
  const off = observer.subscribe(() => {})
  await tick()
  observer.setOptions(options('B', readB, cache))
  await tick()
  gateA.resolve()
  await tick()
  await tick()
  assert.equal(observer.getCurrentResult().error, null)
  assert.deepEqual(observer.getCurrentResult().data, [{ id: 'b-row' }])
  off()
})

test('leaving a filter stops its paged read at the next page', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, networkMode: 'always' } } })
  const cache = memoryCache()
  const pages = []
  const gate = deferred()
  const readA = (_retry, signal) => readAllPages(async (from) => {
    pages.push(from)
    if (from === 0) await gate.promise
    return { data: Array.from({ length: 2 }, (_, i) => ({ id: `${from + i}` })), error: null }
  }, 2, () => signal.aborted)

  const observer = new QueryObserver(qc, options('A', readA, cache))
  const off = observer.subscribe(() => {})
  await tick()
  observer.setOptions(options('B', async () => ({ data: [], error: null }), cache))
  await tick()
  gate.resolve()
  await tick()
  await tick()
  assert.deepEqual(pages, [0], 'no page after the first once A was left')
  off()
})
