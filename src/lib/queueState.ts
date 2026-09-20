// Pure queue-state helpers (no imports) so they can be unit-tested under plain node.

export type QueueOperation = 'insert' | 'update' | 'delete'
export type QueueStatus = 'conflict' | 'expired'

export interface QueueItem {
  id: string
  table: string
  operation: QueueOperation
  payload: Record<string, unknown>
  /** For update/delete: the row id to target */
  rowId?: string
  userId: string
  timestamp: number
  /** Absent = pending. Flagged items are retained until the user resolves them. */
  status?: QueueStatus
  /** Set by "keep mine": skip the conflict check on the next drain. */
  force?: boolean
}

/** Items older than this are flagged as expired on drain, never silently dropped. */
export const MAX_QUEUE_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export const isPending = (item: QueueItem) => !item.status
export const isFlagged = (item: QueueItem) => !!item.status

/** Flags unflagged items older than the max age as expired. */
export function markExpired(queue: QueueItem[], now: number): QueueItem[] {
  return queue.map((item) =>
    !item.status && now - item.timestamp > MAX_QUEUE_AGE_MS
      ? { ...item, status: 'expired' as const }
      : item
  )
}

/** "Keep mine": make a flagged item pending again and force it past the conflict check. */
export function applyKeepMine(queue: QueueItem[], id: string, now: number): QueueItem[] {
  return queue.map((item) => {
    if (item.id !== id || !item.status) return item
    const next = { ...item, force: true, timestamp: now }
    delete next.status
    return next
  })
}

/** Removes the given flagged item (or every flagged item when id is omitted). Returns the rest and the removed items. */
export function removeFlagged(queue: QueueItem[], id?: string) {
  const removed = queue.filter((i) => i.status && (id === undefined || i.id === id))
  const kept = queue.filter((i) => !removed.includes(i))
  return { kept, removed }
}
