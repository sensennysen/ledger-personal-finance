import { supabase } from './supabase'

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
  }

  writeQueue(remaining)
  return synced
}
