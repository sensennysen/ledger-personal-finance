export const PENDING_RECEIPT_PREFIX = 'pending-receipt:'

const DB_NAME = 'ledger_receipts'
const STORE = 'pending'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

interface StoredReceipt {
  blob: Blob
  name: string
  type: string
}

export async function storePendingReceipt(id: string, file: File): Promise<void> {
  const db = await openDb()
  const entry: StoredReceipt = { blob: file, name: file.name, type: file.type }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(entry, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getPendingReceipt(id: string): Promise<File | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => {
      const result = req.result as StoredReceipt | File | null
      if (!result) { resolve(null); return }
      // Handle both the new envelope format and raw File (legacy entries)
      if (result instanceof File) { resolve(result); return }
      const { blob, name, type } = result as StoredReceipt
      resolve(new File([blob], name, { type }))
    }
    req.onerror = () => reject(req.error)
  })
}

export async function removePendingReceipt(id: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
