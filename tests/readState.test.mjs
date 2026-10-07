import { test } from 'node:test'
import assert from 'node:assert/strict'
import { QueryClient, QueryObserver, onlineManager } from '@tanstack/react-query'
import { offlineNoCopyMessage, offlineUnavailable } from '../src/lib/readState.ts'
import { resolveLoadState } from '../src/lib/loadState.ts'
import { entityKey, entityQueryOptions } from '../src/lib/entityQuery.ts'

// LED-307: a list opened offline with no copy on this device says so instead of loading forever.

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

function memoryCache(initial = {}) {
  const store = new Map(Object.entries(initial))
  return { read: (k) => (store.has(k) ? store.get(k) : null), write: (k, d) => { store.set(k, d); return true } }
}

/** What useEntityQuery hands a list view, from the store's result. */
function viewOf(result) {
  const offline = offlineUnavailable({ hasData: result.data !== undefined, paused: result.fetchStatus === 'paused' })
  const error = offline ? offlineNoCopyMessage('your accounts') : null
  const loading = result.isPending && !offline
  return { offline, state: resolveLoadState({ loading, error, hasData: (result.data ?? []).length > 0 }) }
}

test('offline with nothing saved is unavailable; with a copy, or online, it is not', () => {
  assert.equal(offlineUnavailable({ hasData: false, paused: true }), true)
  assert.equal(offlineUnavailable({ hasData: true, paused: true }), false)
  assert.equal(offlineUnavailable({ hasData: false, paused: false }), false)
})

test('the message names the list and says it loads once back online', () => {
  assert.equal(
    offlineNoCopyMessage('your accounts'),
    "You're offline and this device has no saved copy of your accounts. They load when you're back online.",
  )
})

test('opened offline without a copy: an error state, not loading or empty, then it loads on reconnect', async (t) => {
  onlineManager.setOnline(false)
  t.after(() => onlineManager.setOnline(true))
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, networkMode: 'online' } } })
  // QueryClientProvider mounts the client in the app; mounted, it resumes paused reads on reconnect.
  qc.mount()
  t.after(() => qc.unmount())
  let reads = 0
  const read = async () => { reads += 1; return { data: [{ id: 'a' }], error: null } }
  const observer = new QueryObserver(qc, entityQueryOptions({ queryKey: entityKey('u1', 'accounts'), cacheKey: 'u1:accounts', read, cache: memoryCache() }))
  const off = observer.subscribe(() => {})
  await tick()

  const offlineView = viewOf(observer.getCurrentResult())
  assert.equal(offlineView.offline, true)
  assert.equal(offlineView.state, 'error')
  assert.equal(reads, 0)

  onlineManager.setOnline(true)
  await tick()
  await tick()
  const onlineView = viewOf(observer.getCurrentResult())
  assert.equal(reads, 1, 'the paused read resumes on reconnect')
  assert.equal(onlineView.offline, false)
  assert.equal(onlineView.state, 'ready')
  off()
})

test('a copy older than its TTL is gone, so offline it is the same unavailable state', async (t) => {
  onlineManager.setOnline(false)
  t.after(() => onlineManager.setOnline(true))
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, networkMode: 'online' } } })
  // readCache drops an expired entry and returns null: the store sees no copy.
  const expired = { read: () => null, write: () => true }
  const observer = new QueryObserver(qc, entityQueryOptions({ queryKey: entityKey('u1', 'accounts'), cacheKey: 'u1:accounts', read: async () => ({ data: [], error: null }), cache: expired }))
  const off = observer.subscribe(() => {})
  await tick()
  assert.equal(viewOf(observer.getCurrentResult()).state, 'error')
  off()
})

test('offline with a saved copy shows the copy', async (t) => {
  onlineManager.setOnline(false)
  t.after(() => onlineManager.setOnline(true))
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, networkMode: 'online' } } })
  const cache = memoryCache({ 'u1:accounts': [{ id: 'saved' }] })
  const observer = new QueryObserver(qc, entityQueryOptions({ queryKey: entityKey('u1', 'accounts'), cacheKey: 'u1:accounts', read: async () => ({ data: [], error: null }), cache }))
  const off = observer.subscribe(() => {})
  await tick()
  const view = viewOf(observer.getCurrentResult())
  assert.equal(view.offline, false)
  assert.equal(view.state, 'ready')
  off()
})
