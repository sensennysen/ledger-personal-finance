import { supabase } from './supabase'
import { PENDING_RECEIPT_PREFIX, getPendingReceipt, removePendingReceipt } from './receiptStore'

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

  const remaining: QueueItem[] = []
  let synced = 0

  for (const item of queue) {
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
          const fileName = (file as File).name ?? ''
          const ext = fileName.split('.').pop() || 'jpg'
          const path = `${item.userId}/${Date.now()}.${ext}`
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
            const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path)
            item.payload = { ...item.payload, receipt_url: urlData.publicUrl }
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
