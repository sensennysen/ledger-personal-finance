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

  // IDs of items we've fully dealt with this pass (synced or intentionally
  // skipped). Anything else — failures, and rows enqueued *during* this drain —
  // must survive. We recompute the queue from a fresh read at the end rather
  // than overwriting it with a stale snapshot, otherwise a mutation saved while
  // this loop was awaiting the network would be silently discarded.
  const handledIds = new Set<string>()
  let synced = 0

  for (const item of fresh) {
    try {
      let skipInsert = false
      let resolvedReceiptTempId: string | null = null

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
            // Upload failed — leave it in the queue and retry next time
            skipInsert = true
          } else {
            item.payload = { ...item.payload, receipt_url: path }
            // Keep the local copy until the DB insert below also succeeds, so a
            // failed insert can re-run without losing the receipt.
            resolvedReceiptTempId = tempId
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
              handledIds.add(item.id)
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

      if (!error) {
        if (resolvedReceiptTempId) {
          try { await removePendingReceipt(resolvedReceiptTempId) } catch { /* best-effort */ }
        }
        handledIds.add(item.id)
        synced++
      }
      // On error, leave the item untracked so the reconciliation below keeps it.
    } catch {
      // Unexpected error for this item — leave it queued for the next retry.
    }
  }

  // Reconcile against the *current* queue, not the snapshot we started from, so
  // items enqueued mid-drain are preserved. Also re-apply the staleness bound in
  // case the drain itself took a long time.
  const now2 = Date.now()
  const stillPending = readQueue().filter(
    (item) => !handledIds.has(item.id) && now2 - item.timestamp <= MAX_QUEUE_AGE_MS
  )
  writeQueue(stillPending)
  return synced
}
