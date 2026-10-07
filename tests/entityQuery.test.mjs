import { test } from 'node:test'
import assert from 'node:assert/strict'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { entityKey, entityQueryOptions, EntityReadError, describeQueryError } from '../src/lib/entityQuery.ts'

// LED-321: entity reads share one request, one copy and one error policy.

function memoryCache(initial = {}) {
  const store = new Map(Object.entries(initial))
  const writes = []
  return {
    store,
    writes,
    read: (key) => (store.has(key) ? store.get(key) : null),
    write: (key, data) => { writes.push(key); store.set(key, data); return true },
  }
}

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, networkMode: 'always' } } })
}

function countingRead(result) {
  const calls = []
  const read = async (retry, signal) => {
    calls.push({ retry, signal })
    await new Promise((resolve) => setTimeout(resolve, 5))
    return result
  }
  return { read, calls }
}

const settle = (observers) => Promise.all(observers.map((o) => new Promise((resolve) => {
  const done = () => o.getCurrentResult().fetchStatus === 'idle' && !o.getCurrentResult().isPending
  if (done()) return resolve()
  const off = o.subscribe(() => { if (done()) { off(); resolve() } })
})))

test('keys are per user, per entity and per parameters', () => {
  assert.deepEqual(entityKey('u1', 'accounts'), ['ledger', 'u1', 'accounts'])
  assert.deepEqual(entityKey('u1', 'accounts', { includeArchived: true }), ['ledger', 'u1', 'accounts', { includeArchived: true }])
  assert.notDeepEqual(entityKey('u1', 'accounts'), entityKey('u2', 'accounts'))
})

test('the layout, the page and the payment hook mounting together read once', async () => {
  const qc = client()
  const cache = memoryCache()
  const { read, calls } = countingRead({ data: [{ id: 'a' }], error: null })
  const options = () => entityQueryOptions({ queryKey: entityKey('u1', 'accounts', { includeArchived: false }), cacheKey: 'u1:accounts', read, cache })
  const observers = [new QueryObserver(qc, options()), new QueryObserver(qc, options()), new QueryObserver(qc, options())]
  const offs = observers.map((o) => o.subscribe(() => {}))
  await settle(observers)
  assert.equal(calls.length, 1)
  for (const o of observers) assert.deepEqual(o.getCurrentResult().data, [{ id: 'a' }])
  offs.forEach((off) => off())
})

test('different users or parameters never share a read', async () => {
  const qc = client()
  const cache = memoryCache()
  const { read, calls } = countingRead({ data: [], error: null })
  await Promise.all([
    qc.fetchQuery(entityQueryOptions({ queryKey: entityKey('u1', 'accounts', { includeArchived: false }), cacheKey: 'u1:accounts', read, cache })),
    qc.fetchQuery(entityQueryOptions({ queryKey: entityKey('u1', 'accounts', { includeArchived: true }), cacheKey: 'u1:accounts:all', read, cache })),
    qc.fetchQuery(entityQueryOptions({ queryKey: entityKey('u2', 'accounts', { includeArchived: false }), cacheKey: 'u2:accounts', read, cache })),
  ])
  assert.equal(calls.length, 3)
})

test('the device copy shows at once and a read replaces it', async () => {
  const qc = client()
  const cache = memoryCache({ 'u1:accounts': [{ id: 'old' }] })
  const { read } = countingRead({ data: [{ id: 'new' }], error: null })
  const o = new QueryObserver(qc, entityQueryOptions({ queryKey: entityKey('u1', 'accounts'), cacheKey: 'u1:accounts', read, cache }))
  assert.deepEqual(o.getCurrentResult().data, [{ id: 'old' }])
  const off = o.subscribe(() => {})
  await settle([o])
  assert.deepEqual(o.getCurrentResult().data, [{ id: 'new' }])
  assert.deepEqual(cache.store.get('u1:accounts'), [{ id: 'new' }])
  off()
})

test('with a copy on screen the read keeps the library retries; a first load does not', async () => {
  const qc = client()
  const withCopy = countingRead({ data: [], error: null })
  await qc.fetchQuery(entityQueryOptions({ queryKey: ['a'], cacheKey: 'k', read: withCopy.read, cache: memoryCache({ k: [] }) }))
  assert.equal(withCopy.calls[0].retry, true)
  const first = countingRead({ data: [], error: null })
  await qc.fetchQuery(entityQueryOptions({ queryKey: ['b'], cacheKey: 'k', read: first.read, cache: memoryCache() }))
  assert.equal(first.calls[0].retry, false)
})

test('a failed refresh keeps the copy on screen with the error, and never writes the copy', async () => {
  const qc = client()
  const cache = memoryCache({ 'u1:accounts': [{ id: 'old' }] })
  const { read } = countingRead({ data: null, error: { code: '42501', message: 'permission denied' } })
  const o = new QueryObserver(qc, entityQueryOptions({ queryKey: entityKey('u1', 'accounts'), cacheKey: 'u1:accounts', read, cache }))
  const off = o.subscribe(() => {})
  await settle([o])
  const result = o.getCurrentResult()
  assert.deepEqual(result.data, [{ id: 'old' }])
  assert.ok(result.error instanceof EntityReadError)
  assert.equal(describeQueryError(result.error).message, "You don't have access to that. Sign in again and retry.")
  assert.equal(describeQueryError(result.error).detail, '42501 — permission denied')
  assert.deepEqual(cache.writes, [])
  off()
})

test('a cancelled read does not write its copy', async () => {
  const qc = client()
  const cache = memoryCache()
  const key = entityKey('u1', 'accounts')
  const read = (_retry, signal) => new Promise((resolve) => {
    setTimeout(() => resolve({ data: [{ id: 'late' }], error: null }), 20)
    void signal
  })
  const pending = qc.fetchQuery(entityQueryOptions({ queryKey: key, cacheKey: 'u1:accounts', read, cache })).catch(() => {})
  await qc.cancelQueries({ queryKey: key })
  await pending
  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.deepEqual(cache.writes, [])
})
