import { test } from 'node:test'
import assert from 'node:assert/strict'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { INVALIDATES, invalidatedBy, invalidateEntities } from '../src/lib/invalidation.ts'
import { entityKey, entityQueryOptions } from '../src/lib/entityQuery.ts'

// LED-306: every mounted list and total refreshes after a change.

const READS = ['accounts', 'categories', 'transactions', 'savings-goals', 'card-payments', 'exchange-rates', 'budgets', 'loan-purchases']

test('every write names only known reads, and always its own', () => {
  for (const [source, targets] of Object.entries(INVALIDATES)) {
    for (const target of targets) assert.ok(READS.includes(target), `${source} -> ${target}`)
    if (source !== 'sync') assert.ok(targets.includes(source), `${source} refreshes itself`)
  }
  for (const read of READS) assert.ok(read in INVALIDATES, `${read} has an entry`)
})

test('a transaction write reaches balances, budgets, goals, card payments and loans', () => {
  assert.deepEqual(
    [...invalidatedBy('transactions')].sort(),
    ['accounts', 'budgets', 'card-payments', 'loan-purchases', 'savings-goals', 'transactions'],
  )
})

test('a queue drain refreshes what a transaction write does', () => {
  assert.deepEqual(invalidatedBy('sync'), invalidatedBy('transactions'))
})

test('names shown on transactions follow an account or category edit', () => {
  assert.ok(invalidatedBy('accounts').includes('transactions'))
  assert.ok(invalidatedBy('categories').includes('transactions'))
  assert.ok(invalidatedBy('categories').includes('budgets'))
  assert.ok(invalidatedBy('card-payments').includes('accounts'))
})

function memoryCache() {
  const store = new Map()
  return { read: (k) => store.get(k) ?? null, write: (k, d) => { store.set(k, d); return true } }
}

async function settled(observers) {
  await Promise.all(observers.map((o) => new Promise((resolve) => {
    const done = () => o.getCurrentResult().fetchStatus === 'idle' && !o.getCurrentResult().isPending
    if (done()) return resolve()
    const off = o.subscribe(() => { if (done()) { off(); resolve() } })
  })))
}

test('one transaction write refreshes the mounted accounts and every mounted transaction list, and nothing unrelated', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, networkMode: 'always' } } })
  const cache = memoryCache()
  const reads = new Map()
  const observe = (key, cacheKey) => {
    const read = async () => {
      reads.set(cacheKey, (reads.get(cacheKey) ?? 0) + 1)
      return { data: [{ version: reads.get(cacheKey) }], error: null }
    }
    return new QueryObserver(qc, entityQueryOptions({ queryKey: key, cacheKey, read, cache }))
  }
  const observers = [
    observe(entityKey('u1', 'accounts', { includeArchived: false }), 'accounts'),
    observe(entityKey('u1', 'transactions', {}), 'home'),
    observe(entityKey('u1', 'transactions', { accountId: 'a1' }), 'account-page'),
    observe(entityKey('u1', 'categories'), 'categories'),
  ]
  const offs = observers.map((o) => o.subscribe(() => {}))
  await settled(observers)

  const notified = []
  await invalidateEntities(qc, 'transactions', (entity) => notified.push(entity))

  assert.equal(reads.get('accounts'), 2, 'balances re-read')
  assert.equal(reads.get('home'), 2, 'Home re-read')
  assert.equal(reads.get('account-page'), 2, 'a filtered list on another surface re-read')
  assert.equal(reads.get('categories'), 1, 'categories untouched')
  assert.deepEqual(observers[0].getCurrentResult().data, [{ version: 2 }])
  assert.ok(notified.includes('budgets') && notified.includes('card-payments'), 'hooks outside the store hear it')
  offs.forEach((off) => off())
})

test('a read that is not mounted is marked stale, not refetched', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, networkMode: 'always' } } })
  let reads = 0
  const key = entityKey('u1', 'transactions', { categoryId: 'c1' })
  await qc.fetchQuery(entityQueryOptions({ queryKey: key, cacheKey: 'k', read: async () => { reads++; return { data: [], error: null } }, cache: memoryCache() }))
  await invalidateEntities(qc, 'transactions', () => {})
  assert.equal(reads, 1)
  assert.equal(qc.getQueryState(key).isInvalidated, true)
})
