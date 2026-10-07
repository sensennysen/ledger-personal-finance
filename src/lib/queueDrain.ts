// The offline-queue drain, with its I/O passed in so it can run under plain node.
// offlineQueue.ts wires the real supabase client, the IndexedDB queue and receipt store.
import {
  isCountableError,
  isDuplicateRowId,
  isFlagged,
  isPending,
  expireNow,
  mergeDrainResult,
  rebaseRevision,
  rebaseRevisions,
  recordFailure,
  recordRevisionMove,
  removeFlagged,
  rowKey,
  setResolvedReceipt,
  type QueueItem,
  type RevisionMoves,
  type SentInsert,
} from './queueState.ts'

/** A queued row: the table is chosen at run time, so its columns are only known as names. */
type DrainRow = Record<string, unknown>
type DrainResponse<T> = PromiseLike<{ data: T; error: unknown }>

/** The filter chain the drain builds after select, update or delete (LED-320). */
export interface DrainFilter {
  eq: (column: string, value: unknown) => DrainFilter
  maybeSingle: () => DrainResponse<DrainRow | null>
  select: (columns: string) => DrainResponse<DrainRow[] | null>
}

/** The slice of the supabase client the drain uses, typed to just the calls it makes (LED-320). */
export interface DrainClient {
  from: (table: string) => {
    select: (columns: string) => DrainFilter
    insert: (row: DrainRow) => { select: (columns: string) => DrainResponse<DrainRow[] | null> }
    update: (row: DrainRow) => DrainFilter
    delete: () => DrainFilter
  }
  storage: {
    from: (bucket: string) => {
      upload: (path: string, file: File) => Promise<{ error: unknown }>
      remove: (paths: string[]) => Promise<{ error: unknown }>
    }
  }
}

export interface ReceiptDeps {
  /** Prefix that marks a receipt_url as a file still waiting in the local store. */
  prefix: string
  get: (tempId: string) => Promise<File | null>
  remove: (tempId: string) => Promise<void>
  buildPath: (userId: string, fileName: string) => string
}

export interface DrainDeps {
  client: DrainClient
  readQueue: () => Promise<QueueItem[]>
  /**
   * Reads the stored queue, applies `fn` and writes the result as one transaction, so a change
   * made meanwhile (in this tab or another) is never overwritten. Returning the same array writes nothing.
   */
  mutateQueue: (fn: (queue: QueueItem[]) => QueueItem[]) => Promise<void>
  receipts: ReceiptDeps
  now: () => number
  /** Called after an insert reaches the database, with the item as it was sent. A throw is ignored: the row is already saved. */
  onSynced?: (item: QueueItem) => void
}

type Outcome =
  | { kind: 'synced'; inserted?: QueueItem }
  | { kind: 'keep'; item: QueueItem }

const messageOf = (error: unknown) =>
  typeof error === 'object' && error !== null && typeof (error as { message?: unknown }).message === 'string'
    ? (error as { message: string }).message
    : 'Unknown error'

// Any create or edit can carry a receipt waiting in the local store (LED-300).
const isPendingReceipt = (item: QueueItem, prefix: string) =>
  item.operation !== 'delete' &&
  typeof item.payload.receipt_url === 'string' &&
  item.payload.receipt_url.startsWith(prefix)

/**
 * The item without its pending receipt: a create saves no receipt, an edit leaves the row's
 * current receipt alone. A pending marker is never written to the database.
 */
function withoutReceipt(item: QueueItem): QueueItem {
  if (item.operation === 'insert') return { ...item, payload: { ...item.payload, receipt_url: null } }
  const payload = { ...item.payload }
  delete payload.receipt_url
  return { ...item, payload }
}

/** Deletes an uploaded receipt that no row will point at. Best-effort: a stray file is harmless. */
async function removeUploaded(client: DrainClient, path: string) {
  try { await client.storage.from('receipts').remove([path]) } catch { /* best-effort */ }
}

/**
 * Uploads a queued receipt file and points the payload at it. The uploaded path is written to
 * the stored queue before the row is saved, and only then is the local file removed: a save that
 * fails afterwards retries with the path, not with a file that is gone (LED-301). Returns null
 * when the upload failed and the item must wait.
 */
async function resolveReceipt(item: QueueItem, deps: DrainDeps): Promise<QueueItem | null> {
  const { receipts, client } = deps
  const marker = item.payload.receipt_url as string
  const tempId = marker.slice(receipts.prefix.length)
  let file: File | null = null
  try {
    file = await receipts.get(tempId)
  } catch {
    // IndexedDB unavailable: treat as a missing file and save without a receipt
  }
  if (!file) return withoutReceipt(item)

  // A File read back from IndexedDB can come back as a plain Blob without a name.
  const path = receipts.buildPath(item.userId, (file as File).name ?? 'receipt.jpg')
  let uploadError: unknown
  try {
    uploadError = (await client.storage.from('receipts').upload(path, file)).error
  } catch (e) {
    uploadError = e
  }
  if (uploadError) return null

  let recorded = false
  try {
    let applied = false
    await deps.mutateQueue((current) => {
      const result = setResolvedReceipt(current, item.id, marker, path)
      applied = result.applied
      return result.applied ? result.queue : current
    })
    if (!applied) {
      // The receipt was replaced (or the item resolved) while this one uploaded: nothing will use it.
      await removeUploaded(client, path)
      try { await receipts.remove(tempId) } catch { /* best-effort */ }
      return withoutReceipt(item)
    }
    recorded = true
  } catch {
    // Storage is full or unavailable: keep the local file so a retry can upload it again.
  }
  if (recorded) {
    try { await receipts.remove(tempId) } catch { /* best-effort */ }
  }
  return { ...item, uploadedReceipt: path, payload: { ...item.payload, receipt_url: path } }
}

/** Reads the server row an update or delete targets. Returns 'unknown' when the read itself fails. */
async function readServerRow(item: QueueItem, client: DrainClient) {
  try {
    const columns = [...new Set(['updated_at', ...Object.keys(item.payload)])].join(',')
    const { data, error } = await client
      .from(item.table)
      .select(columns)
      .eq('id', item.rowId)
      .eq('user_id', item.userId)
      .maybeSingle()
    if (error) return 'unknown' as const
    return data ?? null
  } catch {
    return 'unknown' as const
  }
}

const newerThanQueued = (row: Record<string, unknown>, item: QueueItem) =>
  typeof row.updated_at === 'string' && new Date(row.updated_at).getTime() > item.timestamp

/** Shown on an item kept because the server copy could not be checked. Nothing was written. */
export const SERVER_CHECK_FAILED = "Couldn't check the saved copy of this row, so nothing was written. It will be tried again."

// The row is gone: an update has nothing left to change; a delete is already done.
const gone = (item: QueueItem): Outcome =>
  item.operation === 'delete'
    ? { kind: 'synced' }
    : { kind: 'keep', item: { ...item, status: 'conflict', conflictKind: 'deleted' } }

// The row changed since the change was made against it.
const editedOnServer = (item: QueueItem, row: Record<string, unknown>): Outcome => ({
  kind: 'keep',
  item:
    item.operation === 'delete'
      ? { ...item, status: 'conflict', conflictKind: 'edited' }
      : { ...item, status: 'conflict', conflictKind: 'edited', serverSnapshot: row },
})

const checkFailed = (item: QueueItem): Outcome => ({ kind: 'keep', item: { ...item, lastError: SERVER_CHECK_FAILED } })

/**
 * An update or delete. It is sent with the revision it was made against, so the database applies
 * it only while the row still has that revision: the check and the write are one statement
 * (LED-297). "Keep mine" (`force`) is the only write without that condition.
 */
async function processWrite(item: QueueItem, deps: DrainDeps, moves: RevisionMoves): Promise<Outcome> {
  const { client } = deps
  let base = item.baseRevision
  if (!item.force && base === undefined) {
    // Queued before LED-297: take the revision from the server, then write against it.
    const row = await readServerRow(item, client)
    if (row === 'unknown') return checkFailed(item)
    if (row === null) return gone(item)
    if (newerThanQueued(row, item)) return editedOnServer(item, row)
    if (typeof row.updated_at === 'string') base = row.updated_at
  }

  let query = (item.operation === 'update' ? client.from(item.table).update(item.payload) : client.from(item.table).delete())
    .eq('id', item.rowId)
    .eq('user_id', item.userId)
  if (!item.force && base !== undefined) query = query.eq('updated_at', base)
  const { data, error } = await query.select('id, updated_at')
  if (error) return { kind: 'keep', item: recordFailure(item, messageOf(error), isCountableError(error)) }

  const written = Array.isArray(data) ? data[0] : undefined
  if (written) {
    if (item.operation === 'update' && typeof written.updated_at === 'string') {
      recordRevisionMove(moves, rowKey(item), base, written.updated_at)
    }
    return { kind: 'synced' }
  }
  if (!Array.isArray(data)) return { kind: 'synced' }

  // Nothing matched: the row was deleted, or someone changed it after `base`.
  if (item.force) return gone(item)
  const row = await readServerRow(item, client)
  if (row === 'unknown') return checkFailed(item)
  if (row === null) return gone(item)
  return editedOnServer(item, row)
}

/**
 * A change queued against a row that was itself still queued has no revision of its own: it
 * takes the one the insert produced (LED-298).
 */
const insertKey = (item: QueueItem) => `${item.table}:${String(item.payload.id)}`

function noteInserted(item: QueueItem, row: unknown, moves: RevisionMoves) {
  const revision = (row as { updated_at?: unknown } | null | undefined)?.updated_at
  if (typeof item.payload.id === 'string' && typeof revision === 'string') {
    recordRevisionMove(moves, insertKey(item), undefined, revision)
  }
}

/**
 * The row id is already taken. When it is our own row, an earlier send committed and only its
 * response was lost: count it synced, once (LED-298). Someone else's id (hidden by RLS) is a
 * genuine failure.
 */
async function reconcileInsert(item: QueueItem, client: DrainClient, moves: RevisionMoves): Promise<Outcome> {
  try {
    const { data, error } = await client
      .from(item.table)
      .select('id, updated_at')
      .eq('id', item.payload.id)
      .eq('user_id', item.userId)
      .maybeSingle()
    if (error) return checkFailed(item)
    if (data) {
      noteInserted(item, data, moves)
      return { kind: 'synced', inserted: item }
    }
  } catch {
    return checkFailed(item)
  }
  return { kind: 'keep', item: recordFailure(item, 'This row id is already in use.', true) }
}

async function processItem(item: QueueItem, deps: DrainDeps, moves: RevisionMoves): Promise<Outcome> {
  const { client, receipts } = deps
  let current = item

  try {
    if (isPendingReceipt(current, receipts.prefix)) {
      const resolved = await resolveReceipt(current, deps)
      if (!resolved) return { kind: 'keep', item: current } // upload failed; retry next drain
      current = resolved
    }

    if (current.operation === 'insert') {
      const { data, error } = await client.from(current.table).insert(current.payload).select('id, updated_at')
      if (error && isDuplicateRowId(error) && typeof current.payload.id === 'string') return await reconcileInsert(current, client, moves)
      if (error) return { kind: 'keep', item: recordFailure(current, messageOf(error), isCountableError(error)) }
      noteInserted(current, Array.isArray(data) ? data[0] : data, moves)
      return { kind: 'synced', inserted: current }
    }

    // An edit that only carried a receipt whose file is gone: nothing left to send.
    if (!current.rowId || (current.operation === 'update' && Object.keys(current.payload).length === 0)) return { kind: 'synced' }
    return await processWrite(rebaseRevision(current, moves), deps, moves)
  } catch {
    // Unexpected error (usually a dropped connection): keep the item as far as it got, so a
    // receipt that already uploaded stays attached (LED-301).
    return { kind: 'keep', item: current }
  }
}

/**
 * Replays all pending operations in order. Successes are removed. An item that hit a database
 * error stays and counts the attempt; after MAX_ATTEMPTS it is flagged 'failed'. Expired items,
 * conflicts (edited or deleted on the server) and failed items are kept for review and skipped.
 * Returns the number of synced items.
 */
export async function drainWith(deps: DrainDeps, onProgress?: (done: number, total: number) => void): Promise<number> {
  const stored = await deps.readQueue()
  const queue = expireNow(stored, deps.now())
  if (queue.length === 0) return 0

  const fresh = queue.filter(isPending)
  if (fresh.length === 0) {
    if (queue !== stored) await deps.mutateQueue((current) => expireNow(current, deps.now()))
    return 0
  }

  const remaining: QueueItem[] = queue.filter(isFlagged)
  const seenIds = new Set(queue.map((i) => i.id))
  const flaggedAtStart = new Set(stored.filter(isFlagged).map((i) => i.id))
  // Revisions this drain wrote: our own write bumps updated_at, so a later queued
  // change to the same row is moved onto it instead of being flagged as a conflict.
  const moves: RevisionMoves = new Map()
  // Rows whose queued create has not reached the database: a change to one waits for it,
  // or a delete would find nothing and be dropped while the insert later creates the row.
  // Creates this drain saved, so an edit made while one was in flight is not dropped (LED-299).
  const sent = new Map<string, SentInsert>()
  const unsentRows = new Set(queue.filter((i) => isFlagged(i) && i.operation === 'insert').map(insertKey))
  let synced = 0

  for (const [index, item] of fresh.entries()) {
    if (item.operation !== 'insert' && unsentRows.has(rowKey(item))) {
      remaining.push(item)
      onProgress?.(index + 1, fresh.length)
      continue
    }
    try {
      const outcome = await processItem(item, deps, moves)
      if (outcome.kind === 'synced') {
        synced++
        if (outcome.inserted) {
          sent.set(item.id, { version: item.version ?? 0, payload: outcome.inserted.payload })
          try { deps.onSynced?.(outcome.inserted) } catch { /* the row is saved; a follow-up reports its own failure */ }
        }
      } else {
        remaining.push(outcome.item)
        if (item.operation === 'insert') unsentRows.add(insertKey(item))
      }
    } catch {
      // Unexpected error (usually a dropped connection): keep the item for the next drain.
      remaining.push(item)
      if (item.operation === 'insert') unsentRows.add(insertKey(item))
    } finally {
      onProgress?.(index + 1, fresh.length)
    }
  }

  // Re-read: the user may have resolved or enqueued items while we awaited the network.
  await deps.mutateQueue((current) => rebaseRevisions(mergeDrainResult(remaining, current, seenIds, flaggedAtStart, sent), moves))
  return synced
}

/** "Keep theirs" / "Discard": drop the flagged item (or all of them) and any receipt file it held. */
export async function discardFlagged(
  deps: Pick<DrainDeps, 'mutateQueue' | 'receipts'> & { client?: DrainClient },
  id?: string,
): Promise<void> {
  let removed: QueueItem[] = []
  await deps.mutateQueue((current) => {
    const result = removeFlagged(current, id)
    removed = result.removed
    return removed.length > 0 ? result.kept : current
  })
  for (const item of removed) {
    // A receipt the drain uploaded for a change that never reached its row.
    if (item.uploadedReceipt && deps.client) await removeUploaded(deps.client, item.uploadedReceipt)
    if (!isPendingReceipt(item, deps.receipts.prefix)) continue
    try { await deps.receipts.remove((item.payload.receipt_url as string).slice(deps.receipts.prefix.length)) } catch { /* best-effort */ }
  }
}

/** The part of the Web Locks API the drain uses (navigator.locks). */
export interface LockManagerLike {
  request: <T>(name: string, callback: () => Promise<T>) => Promise<T>
}

/**
 * Runs `run` while holding the named lock, so tabs sharing one queue drain one after another and
 * never send the same item twice (LED-302). A tab that waits drains what is left, usually nothing.
 * Without Web Locks it runs unlocked; replays stay safe because inserts are idempotent (LED-298)
 * and changes carry their revision (LED-297).
 */
export function exclusive<T>(locks: LockManagerLike | undefined, name: string, run: () => Promise<T>): Promise<T> {
  return locks ? locks.request(name, run) : run()
}

/**
 * Wraps a drain so only one runs at a time: a call made while one is running gets that
 * run's result (and progress) instead of starting a second replay of the same items.
 */
export function singleFlight(
  run: (onProgress?: (done: number, total: number) => void) => Promise<number>,
): (onProgress?: (done: number, total: number) => void) => Promise<number> {
  let inFlight: Promise<number> | null = null
  return (onProgress) => {
    if (inFlight) return inFlight
    inFlight = run(onProgress).finally(() => {
      inFlight = null
    })
    return inFlight
  }
}
