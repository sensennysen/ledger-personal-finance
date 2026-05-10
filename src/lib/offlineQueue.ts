import { supabase } from './supabase'
import { PENDING_RECEIPT_PREFIX, getPendingReceipt, removePendingReceipt } from './receiptStore'
import { buildReceiptObjectPath } from './receiptUrls'

export type QueueOperation = 'insert' | 'update' | 'delete'

export interface QueueItem {
  id: string
  table: string
  operation: QueueOperation
  payload: Record<string, unknown>
  /** For update/delete: the row id to target */
  rowId?: string
  userId: string
  timestamp: number
}

const QUEUE_KEY = 'ledger_offline_queue'

/** Queue items older than this are dropped on drain to avoid stale mutations. */
const MAX_QUEUE_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

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

function writeQueue(items: QueueItem[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items))
}

export function clearOfflineQueue(): void {
  localStorage.removeItem(QUEUE_KEY)
}

export function enqueue(item: Omit<QueueItem, 'id' | 'timestamp'>): void {
  const queue = readQueue()
  queue.push({ ...item, id: crypto.randomUUID(), timestamp: Date.now() })
  writeQueue(queue)
}

export function pendingCount(): number {
  return readQueue().length
}

/**
 * Replays all queued operations against Supabase in order.
 * Removes items that succeed; leaves failed items in the queue.
 * Returns the number of successfully synced items.
 */
export async function drainQueue(): Promise<number> {
  const queue = readQueue()
  if (queue.length === 0) return 0

  // Drop items that are too old to be reliably replayed
  const now = Date.now()
  const fresh = queue.filter((item) => now - item.timestamp <= MAX_QUEUE_AGE_MS)
  const staleCount = queue.length - fresh.length
  if (staleCount > 0) {
    console.warn(`[offlineQueue] Dropping ${staleCount} stale item(s) older than 30 days`)
    writeQueue(fresh)
  }
  if (fresh.length === 0) return 0

  const remaining: QueueItem[] = []
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
        try {
          const { data: serverRow } = await supabase
            .from(item.table)
            .select('updated_at')
            .eq('id', item.rowId)
            .eq('user_id', item.userId)
            .maybeSingle()
          if (serverRow?.updated_at) {
            const serverMs = new Date(serverRow.updated_at as string).getTime()
            if (serverMs > item.timestamp) {
              console.warn(
                `[offlineQueue] Conflict detected for ${item.table}:${item.rowId} — skipping stale update`
              )
              synced++ // count as processed
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
