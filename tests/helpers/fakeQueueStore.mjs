// An in-memory stand-in for the localStorage-backed queue, so a test can change the
// queue while a drain is awaiting the network.

export function fakeQueueStore(initial = []) {
  let items = structuredClone(initial)
  const writes = []
  return {
    read: () => structuredClone(items),
    write(next) {
      items = structuredClone(next)
      writes.push(structuredClone(next))
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
  return { client, readQueue: store.read, writeQueue: store.write, receipts, now: () => NOW }
}
