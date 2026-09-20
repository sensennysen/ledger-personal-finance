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

/** Key identifying the server row an update/delete targets. */
export const rowKey = (item: QueueItem) => `${item.table}:${item.rowId}`

/**
 * Combines a drain's result with the queue as it is now, so changes made while
 * the drain was awaiting the network are not overwritten.
 *
 * - `remaining`: items the drain wants to keep (unsynced, failed, flagged).
 * - `flaggedAtStart`: ids that were already flagged in storage when the drain began;
 *   the user may have resolved these mid-drain, so the current copy wins.
 * - Items no longer in `current` (resolved via keep-theirs or cleared) are dropped.
 * - Items in `current` that the drain never saw (enqueued mid-drain) are appended.
 */
export function mergeDrainResult(
  remaining: QueueItem[],
  current: QueueItem[],
  seenIds: Set<string>,
  flaggedAtStart: Set<string>
): QueueItem[] {
  const currentById = new Map(current.map((i) => [i.id, i]))
  const merged: QueueItem[] = []
  for (const item of remaining) {
    const cur = currentById.get(item.id)
    if (!cur) continue
    merged.push(flaggedAtStart.has(item.id) ? cur : item)
  }
  for (const item of current) if (!seenIds.has(item.id)) merged.push(item)
  return merged
}

/** Removes the given flagged item (or every flagged item when id is omitted). Returns the rest and the removed items. */
export function removeFlagged(queue: QueueItem[], id?: string) {
  const removed = queue.filter((i) => i.status && (id === undefined || i.id === id))
  const kept = queue.filter((i) => !removed.includes(i))
  return { kept, removed }
}
