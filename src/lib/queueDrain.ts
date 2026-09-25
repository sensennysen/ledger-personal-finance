// The offline-queue drain, with its I/O passed in so it can run under plain node.
// offlineQueue.ts wires the real supabase client, localStorage and receipt store.
import {
  isCountableError,
  isFlagged,
  isPending,
  markExpired,
  mergeDrainResult,
  recordFailure,
  removeFlagged,
  rowKey,
  type QueueItem,
} from './queueState.ts'

/** The slice of the supabase client the drain uses. Left loose: the query builder is a long chain. */
export interface DrainClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
  storage: {
    from: (bucket: string) => {
      upload: (path: string, file: File) => Promise<{ error: unknown }>
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
  readQueue: () => QueueItem[]
  writeQueue: (items: QueueItem[]) => void
  receipts: ReceiptDeps
  now: () => number
}

type Outcome =
  | { kind: 'synced' }
  | { kind: 'keep'; item: QueueItem }

const messageOf = (error: unknown) =>
  typeof error === 'object' && error !== null && typeof (error as { message?: unknown }).message === 'string'
    ? (error as { message: string }).message
    : 'Unknown error'

const isPendingReceipt = (item: QueueItem, prefix: string) =>
  item.operation === 'insert' &&
  typeof item.payload.receipt_url === 'string' &&
  item.payload.receipt_url.startsWith(prefix)

/** Uploads a queued receipt file and points the payload at it. Returns null when the upload failed and the item must wait. */
async function resolveReceipt(item: QueueItem, receipts: ReceiptDeps, client: DrainClient): Promise<QueueItem | null> {
  const tempId = (item.payload.receipt_url as string).slice(receipts.prefix.length)
  let file: File | null = null
  try {
    file = await receipts.get(tempId)
  } catch {
    // IndexedDB unavailable: treat as a missing file and insert without a receipt
  }
  if (!file) return { ...item, payload: { ...item.payload, receipt_url: null } }

  // A File read back from IndexedDB can come back as a plain Blob without a name.
  const path = receipts.buildPath(item.userId, (file as File).name ?? 'receipt.jpg')
  let uploadError: unknown
  try {
    uploadError = (await client.storage.from('receipts').upload(path, file)).error
  } catch (e) {
    uploadError = e
  }
  if (uploadError) return null
  try { await receipts.remove(tempId) } catch { /* best-effort */ }
  return { ...item, payload: { ...item.payload, receipt_url: path } }
}

/**
 * Reads the server row an update or delete targets. Returns 'unknown' when the check itself
 * fails, so the write goes ahead as it always did.
 */
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
    return (data as Record<string, unknown> | null) ?? null
  } catch {
    return 'unknown' as const
  }
}

const newerThanQueued = (row: Record<string, unknown>, item: QueueItem) =>
  typeof row.updated_at === 'string' && new Date(row.updated_at).getTime() > item.timestamp

async function processItem(item: QueueItem, deps: DrainDeps, updatedRows: Set<string>): Promise<Outcome> {
  const { client, receipts } = deps
  let current = item

  if (isPendingReceipt(current, receipts.prefix)) {
    const resolved = await resolveReceipt(current, receipts, client)
    if (!resolved) return { kind: 'keep', item: current } // upload failed; retry next drain
    current = resolved
  }

  if (current.operation === 'insert') {
    const { error } = await client.from(current.table).insert(current.payload)
    if (error) return { kind: 'keep', item: recordFailure(current, messageOf(error), isCountableError(error)) }
    return { kind: 'synced' }
  }

  if (!current.rowId) return { kind: 'synced' }
  const checked = !current.force && !updatedRows.has(rowKey(current))

  if (current.operation === 'update') {
    if (checked) {
      const row = await readServerRow(current, client)
      if (row === null) return { kind: 'keep', item: { ...current, status: 'conflict', conflictKind: 'deleted' } }
      if (row !== 'unknown' && newerThanQueued(row, current)) {
        return { kind: 'keep', item: { ...current, status: 'conflict', conflictKind: 'edited', serverSnapshot: row } }
      }
    }
    const { data, error } = await client
      .from(current.table)
      .update(current.payload)
      .eq('id', current.rowId)
      .eq('user_id', current.userId)
      .select('id')
    if (error) return { kind: 'keep', item: recordFailure(current, messageOf(error), isCountableError(error)) }
    // Zero rows touched: the row went away between the check and the write.
    if (Array.isArray(data) && data.length === 0) {
      return { kind: 'keep', item: { ...current, status: 'conflict', conflictKind: 'deleted' } }
    }
    updatedRows.add(rowKey(current))
    return { kind: 'synced' }
  }

  // delete
  if (checked) {
    const row = await readServerRow(current, client)
    if (row === null) return { kind: 'synced' } // already gone: nothing left to delete
    if (row !== 'unknown' && newerThanQueued(row, current)) {
      return { kind: 'keep', item: { ...current, status: 'conflict', conflictKind: 'edited' } }
    }
  }
  const { error } = await client
    .from(current.table)
    .delete()
    .eq('id', current.rowId)
    .eq('user_id', current.userId)
  if (error) return { kind: 'keep', item: recordFailure(current, messageOf(error), isCountableError(error)) }
  return { kind: 'synced' }
}

/**
 * Replays all pending operations in order. Successes are removed. An item that hit a database
 * error stays and counts the attempt; after MAX_ATTEMPTS it is flagged 'failed'. Expired items,
 * conflicts (edited or deleted on the server) and failed items are kept for review and skipped.
 * Returns the number of synced items.
 */
export async function drainWith(deps: DrainDeps, onProgress?: (done: number, total: number) => void): Promise<number> {
  const stored = deps.readQueue()
  const queue = markExpired(stored, deps.now())
  if (queue.length === 0) return 0

  const fresh = queue.filter(isPending)
  if (fresh.length === 0) {
    deps.writeQueue(queue)
    return 0
  }

  const remaining: QueueItem[] = queue.filter(isFlagged)
  const seenIds = new Set(queue.map((i) => i.id))
  const flaggedAtStart = new Set(stored.filter(isFlagged).map((i) => i.id))
  // Rows this drain already updated: our own write bumps updated_at, so a later
  // queued change to the same row must not be flagged as a conflict.
  const updatedRows = new Set<string>()
  let synced = 0

  for (const [index, item] of fresh.entries()) {
    try {
      const outcome = await processItem(item, deps, updatedRows)
      if (outcome.kind === 'synced') synced++
      else remaining.push(outcome.item)
    } catch {
      // Unexpected error (usually a dropped connection): keep the item for the next drain.
      remaining.push(item)
    } finally {
      onProgress?.(index + 1, fresh.length)
    }
  }

  // Re-read: the user may have resolved or enqueued items while we awaited the network.
  deps.writeQueue(mergeDrainResult(remaining, deps.readQueue(), seenIds, flaggedAtStart))
  return synced
}

/** "Keep theirs" / "Discard": drop the flagged item (or all of them) and any receipt file it held. */
export async function discardFlagged(
  deps: Pick<DrainDeps, 'readQueue' | 'writeQueue' | 'receipts'>,
  id?: string,
): Promise<void> {
  const { kept, removed } = removeFlagged(deps.readQueue(), id)
  deps.writeQueue(kept)
  for (const item of removed) {
    if (!isPendingReceipt(item, deps.receipts.prefix)) continue
    try { await deps.receipts.remove((item.payload.receipt_url as string).slice(deps.receipts.prefix.length)) } catch { /* best-effort */ }
  }
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
