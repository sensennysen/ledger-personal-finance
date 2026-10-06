import type { QueueItem } from './queueState'

// The offline queue, stored in IndexedDB (LED-303). One record holds the whole queue in order,
// and every change reads and writes it inside one readwrite transaction: a change made by another
// tab can never land between the read and the write. Queue contents are local user data, not
// secure storage.

export const QUEUE_DB_NAME = 'ledger_offline_queue'
const STORE = 'queue'
const RECORD = 'items'
const DB_VERSION = 1

let opening: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (opening) return opening
  opening = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser'))
      return
    }
    const req = indexedDB.open(QUEUE_DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => {
      const db = req.result
      // A newer version opened in another tab: let it upgrade, and reopen on the next call.
      db.onversionchange = () => {
        db.close()
        opening = null
      }
      resolve(db)
    }
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('The offline queue is blocked by another tab'))
  })
  opening.catch(() => {
    opening = null
  })
  return opening
}

/** Reads the stored queue. Rejects when it cannot be read: a failed read is never an empty queue. */
export async function readStoredQueue(): Promise<QueueItem[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(RECORD)
    req.onsuccess = () => resolve((req.result as QueueItem[] | undefined) ?? [])
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('Reading the offline queue was aborted'))
  })
}

/**
 * Applies `fn` to the stored queue and writes the result in the same transaction. Resolves with
 * the committed queue once the write is durable; rejects (quota, storage unavailable) with nothing
 * written. When `fn` returns the array it was given, nothing is written.
 */
export async function mutateStoredQueue(fn: (queue: QueueItem[]) => QueueItem[]): Promise<QueueItem[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    let result: QueueItem[] = []
    const req = store.get(RECORD)
    req.onsuccess = () => {
      const current = (req.result as QueueItem[] | undefined) ?? []
      try {
        result = fn(current)
      } catch (err) {
        tx.abort()
        reject(err)
        return
      }
      if (result !== current) store.put(result, RECORD)
    }
    tx.oncomplete = () => resolve(result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('Writing the offline queue was aborted'))
  })
}
