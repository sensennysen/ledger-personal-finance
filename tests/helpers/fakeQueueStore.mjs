// An in-memory stand-in for the IndexedDB queue, so a test can change the queue while a
// drain is awaiting the network. `mutate` reads and writes in one step, like a transaction.

export function fakeQueueStore(initial = []) {
  let items = structuredClone(initial)
  const writes = []
  return {
    read: () => structuredClone(items),
    write(next) {
      items = structuredClone(next)
      writes.push(structuredClone(next))
    },
    async mutate(fn) {
      const current = structuredClone(items)
      const next = fn(current)
      if (next !== current) this.write(next)
    },
    writes,
  }
}

export function fakeReceipts({ files = {}, removed = [] } = {}) {
  return {
    prefix: 'pending-receipt:',
    get: async (id) => files[id] ?? null,
    remove: async (id) => { removed.push(id) },
    buildPath: (userId, name) => `${userId}/${name}`,
    removed,
  }
}

export const NOW = 1_800_000_000_000
export const queued = (o) => ({
  id: 'a', table: 'transactions', operation: 'update', payload: { amount: 5 },
  rowId: 'row-a', userId: 'u', timestamp: NOW - 1000, ...o,
})

export function depsFor(client, store, receipts = fakeReceipts()) {
  return { client, ...queueDeps(store), receipts, now: () => NOW }
}

/** The queue half of DrainDeps, backed by a fake store. */
export function queueDeps(store) {
  return { readQueue: async () => store.read(), mutateQueue: (fn) => store.mutate(fn) }
}

/** A stand-in for navigator.locks: callers holding the same name run one after another. */
export function fakeLocks() {
  const tails = new Map()
  return {
    request(name, callback) {
      const run = (tails.get(name) ?? Promise.resolve()).then(() => callback())
      tails.set(name, run.catch(() => {}))
      return run
    },
  }
}
