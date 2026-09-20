import { supabase } from './supabase'
import { PENDING_RECEIPT_PREFIX, getPendingReceipt, removePendingReceipt } from './receiptStore'
import { buildReceiptObjectPath } from './receiptUrls'
import {
  applyKeepMine,
  isFlagged,
  isPending,
  markExpired,
  removeFlagged,
  type QueueItem,
} from './queueState'

export type { QueueItem, QueueOperation, QueueStatus } from './queueState'

const QUEUE_KEY = 'ledger_offline_queue'

// localStorage is used here only for resilient device-local sync state.
// Queue contents should be treated as local user data, not secure storage.

function readQueue(): QueueItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? (JSON.parse(raw) as QueueItem[]) : []
  } catch {
    return []
  }
}

type QueueListener = () => void
const queueListeners = new Set<QueueListener>()

/** Subscribe to queue changes (enqueue, drain, resolve). Returns an unsubscribe fn. */
export function subscribeQueue(cb: QueueListener): () => void {
  queueListeners.add(cb)
  return () => {
    queueListeners.delete(cb)
  }
}

function writeQueue(items: QueueItem[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items))
  queueListeners.forEach((cb) => cb())
}

export function clearOfflineQueue(): void {
  localStorage.removeItem(QUEUE_KEY)
  queueListeners.forEach((cb) => cb())
}

export function enqueue(item: Omit<QueueItem, 'id' | 'timestamp'>): void {
  const queue = readQueue()
  queue.push({ ...item, id: crypto.randomUUID(), timestamp: Date.now() })
  writeQueue(queue)
}

/** Items still waiting to sync (excludes conflicted and expired items). */
export function pendingCount(): number {
  return readQueue().filter(isPending).length
}

/** Items the user must review: conflicted or expired. */
export function flaggedCount(): number {
  return readQueue().filter(isFlagged).length
}

export function listQueue(): QueueItem[] {
  return readQueue()
}

/** Keep the local edit: it is retried on the next drain, bypassing the conflict check. */
export function keepMine(id: string): void {
  writeQueue(applyKeepMine(readQueue(), id, Date.now()))
}

/** Keep the server version: discard the local item (and any pending receipt blob). */
export async function keepTheirs(id?: string): Promise<void> {
  const { kept, removed } = removeFlagged(readQueue(), id)
  writeQueue(kept)
  for (const item of removed) await discardReceipt(item)
}

async function discardReceipt(item: QueueItem): Promise<void> {
  const url = item.payload.receipt_url
  if (item.operation === 'insert' && typeof url === 'string' && url.startsWith(PENDING_RECEIPT_PREFIX)) {
    try { await removePendingReceipt(url.slice(PENDING_RECEIPT_PREFIX.length)) } catch { /* best-effort */ }
  }
}

/**
 * Replays all pending operations against Supabase in order.
 * Removes items that succeed; leaves failed items in the queue.
 * Items past the max age are flagged 'expired' and updates whose server row
 * changed are flagged 'conflict'; both are retained for user review and skipped.
 * Returns the number of successfully synced items.
 */
export async function drainQueue(): Promise<number> {
  const queue = markExpired(readQueue(), Date.now())
  if (queue.length === 0) return 0

  const fresh = queue.filter(isPending)
  if (fresh.length === 0) {
    writeQueue(queue)
    return 0
  }

  const remaining: QueueItem[] = queue.filter(isFlagged)
  let synced = 0

  for (const item of fresh) {
    try {
      let skipInsert = false

      // Resolve any pending receipt file before the DB insert
      if (
        item.operation === 'insert' &&
        typeof item.payload.receipt_url === 'string' &&
        item.payload.receipt_url.startsWith(PENDING_RECEIPT_PREFIX)
      ) {
        const tempId = item.payload.receipt_url.slice(PENDING_RECEIPT_PREFIX.length)
        let file: File | null = null
        try {
          file = await getPendingReceipt(tempId)
        } catch {
          // IndexedDB unavailable — treat as missing file, insert without receipt
        }
        if (file) {
          // When retrieved from IndexedDB, a File may come back as a plain Blob
          // without a .name property on some browsers — guard against that.
          const fileName = (file as File).name ?? 'receipt.jpg'
          const path = buildReceiptObjectPath(item.userId, fileName)
          let uploadErr: unknown = null
          try {
            const { error: err } = await supabase.storage.from('receipts').upload(path, file)
            uploadErr = err
          } catch (e) {
            uploadErr = e
          }
          if (uploadErr) {
            // Upload failed — keep in queue and retry next time
            remaining.push(item)
            skipInsert = true
          } else {
            item.payload = { ...item.payload, receipt_url: path }
            try { await removePendingReceipt(tempId) } catch { /* best-effort */ }
          }
        } else {
          // File missing (e.g. IndexedDB was cleared) — insert without receipt
          item.payload = { ...item.payload, receipt_url: null }
        }
      }

      if (skipInsert) continue

      let error: unknown = null
      if (item.operation === 'insert') {
        const { error: err } = await supabase.from(item.table).insert(item.payload)
        error = err
      } else if (item.operation === 'update' && item.rowId) {
        // Conflict detection: if the server record's updated_at is newer than when
        // we queued this change, a concurrent edit happened — skip to avoid overwrite.
        if (!item.force) try {
          const { data: serverRow } = await supabase
            .from(item.table)
            .select('updated_at')
            .eq('id', item.rowId)
            .eq('user_id', item.userId)
            .maybeSingle()
          if (serverRow?.updated_at) {
            const serverMs = new Date(serverRow.updated_at as string).getTime()
            if (serverMs > item.timestamp) {
              remaining.push({ ...item, status: 'conflict' })
              continue
            }
          }
        } catch {
          // If the conflict check itself fails, proceed with the update anyway
        }
        const { error: err } = await supabase
          .from(item.table)
          .update(item.payload)
          .eq('id', item.rowId)
          .eq('user_id', item.userId)
        error = err
      } else if (item.operation === 'delete' && item.rowId) {
        const { error: err } = await supabase
          .from(item.table)
          .delete()
          .eq('id', item.rowId)
          .eq('user_id', item.userId)
        error = err
      }

      if (error) {
        remaining.push(item)
      } else {
        synced++
      }
    } catch {
      // Unexpected error for this item — keep it in the queue for the next retry
      remaining.push(item)
    }
  }

  writeQueue(remaining)
  return synced
}
