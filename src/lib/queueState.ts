// Pure queue-state helpers (no imports) so they can be unit-tested under plain node.

export type QueueOperation = 'insert' | 'update' | 'delete'
export type QueueStatus = 'conflict' | 'expired' | 'failed'
/** Why a conflict was flagged: the server row changed, or it no longer exists. */
export type ConflictKind = 'edited' | 'deleted'

export interface QueueItem {
  id: string
  table: string
  operation: QueueOperation
  payload: Record<string, unknown>
  /** For update/delete: the row id to target */
  rowId?: string
  /**
   * For update/delete: the server's updated_at the change was made against. The write only
   * applies while the row still has it (LED-297). Absent on items queued before that.
   */
  baseRevision?: string
  /** Display name captured at enqueue time, for the queue sheet. Never sent to the database. */
  label?: string
  userId: string
  timestamp: number
  /** Absent = pending. Flagged items are retained until the user resolves them. */
  status?: QueueStatus
  /** Set by "keep mine": skip the conflict check on the next drain. */
  force?: boolean
  /** Set with status 'conflict'. */
  conflictKind?: ConflictKind
  /** The server's values for the fields this item changes, captured when the conflict was found. */
  serverSnapshot?: Record<string, unknown>
  /** Database errors seen on this item so far. */
  attempts?: number
  /** The last database error message, shown for a failed item. */
  lastError?: string
}

/** A database error that is not a conflict is retried this many times, then the item is flagged 'failed'. */
export const MAX_ATTEMPTS = 5

/** Items older than this are flagged as expired on drain, never silently dropped. */
export const MAX_QUEUE_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export const isPending = (item: QueueItem) => !item.status
export const isFlagged = (item: QueueItem) => !!item.status

/** True when a drain result is a database error rather than a lost connection. */
export function isCountableError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' && code !== ''
}

/**
 * Records one failed attempt. A countable error adds to `attempts` and flags the
 * item 'failed' at the limit; anything else (a dropped connection) keeps it pending untouched.
 */
export function recordFailure(item: QueueItem, message: string, countable: boolean): QueueItem {
  if (!countable) return item
  const attempts = (item.attempts ?? 0) + 1
  const next: QueueItem = { ...item, attempts, lastError: message }
  if (attempts >= MAX_ATTEMPTS) next.status = 'failed'
  return next
}

/** "Retry": make a failed item pending again with a fresh attempt count. */
export function retryFailed(queue: QueueItem[], id: string): QueueItem[] {
  return queue.map((item) => {
    if (item.id !== id || item.status !== 'failed') return item
    const next = { ...item }
    delete next.status
    delete next.attempts
    delete next.lastError
    return next
  })
}

/**
 * "Fix" on a queued create (LED-193): an edit made while the row is still only in the queue
 * changes that queued insert's payload, so the row syncs once with the corrected values. A
 * queued edit would target a row the database has not seen yet. A failed insert (a typo the
 * database rejected) becomes pending again with a fresh attempt count. Anything else, a
 * conflict or an expired item included, is left alone and `edited` is false.
 */
export function editQueuedInsert(
  queue: QueueItem[],
  rowId: string,
  values: Record<string, unknown>,
): { queue: QueueItem[]; edited: boolean } {
  let edited = false
  const next = queue.map((item) => {
    if (
      edited ||
      item.table !== 'transactions' ||
      item.operation !== 'insert' ||
      item.payload.id !== rowId ||
      (item.status && item.status !== 'failed')
    ) {
      return item
    }
    edited = true
    const fixed: QueueItem = {
      ...item,
      payload: { ...item.payload, ...values, id: rowId, user_id: item.payload.user_id },
    }
    if (typeof values.description === 'string') fixed.label = values.description
    delete fixed.status
    delete fixed.attempts
    delete fixed.lastError
    return fixed
  })
  return { queue: edited ? next : queue, edited }
}

/** When the earliest pending item passes the max age, or null when nothing is pending. */
export function nextExpiryAt(queue: QueueItem[]): number | null {
  const stamps = queue.filter(isPending).map((item) => item.timestamp)
  return stamps.length === 0 ? null : Math.min(...stamps) + MAX_QUEUE_AGE_MS + 1
}

/** Like markExpired, but returns the same array when nothing changed so callers can skip a write. */
export function expireNow(queue: QueueItem[], now: number): QueueItem[] {
  const next = markExpired(queue, now)
  return next.some((item, i) => item !== queue[i]) ? next : queue
}

export interface ConflictField {
  field: string
  mine: unknown
  theirs: unknown
}

/** The fields a conflicted update changes where the server now holds something else. */
export function describeConflict(item: QueueItem): ConflictField[] {
  if (item.status !== 'conflict' || item.conflictKind === 'deleted' || !item.serverSnapshot) return []
  const fields: ConflictField[] = []
  for (const [field, mine] of Object.entries(item.payload)) {
    if (!(field in item.serverSnapshot)) continue
    const theirs = item.serverSnapshot[field]
    if (JSON.stringify(mine) !== JSON.stringify(theirs)) fields.push({ field, mine, theirs })
  }
  return fields
}

/** Flags unflagged items older than the max age as expired. */
export function markExpired(queue: QueueItem[], now: number): QueueItem[] {
  return queue.map((item) =>
    !item.status && now - item.timestamp > MAX_QUEUE_AGE_MS
      ? { ...item, status: 'expired' as const }
      : item
  )
}

/** An update to a row the server deleted has nothing left to overwrite, so it can only be discarded. */
export const canKeepMine = (item: QueueItem) =>
  !(item.status === 'conflict' && item.conflictKind === 'deleted')

/** "Keep mine": make a flagged item pending again and force it past the conflict check. */
export function applyKeepMine(queue: QueueItem[], id: string, now: number): QueueItem[] {
  return queue.map((item) => {
    if (item.id !== id || !item.status) return item
    const next = { ...item, force: true, timestamp: now }
    delete next.status
    delete next.conflictKind
    delete next.serverSnapshot
    delete next.attempts
    delete next.lastError
    return next
  })
}

/** Key identifying the server row an update/delete targets. */
export const rowKey = (item: QueueItem) => `${item.table}:${item.rowId}`

/**
 * The revisions a drain wrote, per row: which revision each write replaced, and the latest one.
 * A later queued change made against a revision we replaced is moved onto ours, so our own
 * write is never mistaken for someone else's edit (LED-297).
 */
export type RevisionMoves = Map<string, { replaced: Map<string, string>; latest: string }>

export function recordRevisionMove(moves: RevisionMoves, key: string, from: string | undefined, to: string): void {
  const entry = moves.get(key) ?? { replaced: new Map<string, string>(), latest: to }
  if (from !== undefined && from !== to) entry.replaced.set(from, to)
  entry.latest = to
  moves.set(key, entry)
}

/**
 * Moves an update/delete onto the revision this drain left the row at. An item with no
 * revision (queued before LED-297) takes the latest one: the row holds what we wrote.
 * A revision we did not replace is someone else's, and is left alone.
 */
export function rebaseRevision(item: QueueItem, moves: RevisionMoves): QueueItem {
  if (item.operation === 'insert' || !item.rowId) return item
  const entry = moves.get(rowKey(item))
  if (!entry) return item
  if (item.baseRevision === undefined) return { ...item, baseRevision: entry.latest }
  let revision = item.baseRevision
  const seen = new Set<string>()
  while (entry.replaced.has(revision) && !seen.has(revision)) {
    seen.add(revision)
    revision = entry.replaced.get(revision)!
  }
  return revision === item.baseRevision ? item : { ...item, baseRevision: revision }
}

export const rebaseRevisions = (items: QueueItem[], moves: RevisionMoves) =>
  moves.size === 0 ? items : items.map((item) => rebaseRevision(item, moves))

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
