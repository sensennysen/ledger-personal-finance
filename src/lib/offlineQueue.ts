import { supabase } from './supabase'
import { PENDING_RECEIPT_PREFIX, getPendingReceipt, removePendingReceipt } from './receiptStore'
import { buildReceiptObjectPath } from './receiptUrls'
import { discardFlagged, drainWith, exclusive, singleFlight, type DrainClient, type DrainDeps, type LockManagerLike } from './queueDrain'
import { mutateStoredQueue, readStoredQueue } from './queueStorage'
import {
  QUEUE_STORAGE_FAILED,
  applyKeepMine,
  appendItems,
  expireNow,
  isFlagged,
  isPending,
  mergeLegacyQueue,
  nextExpiryAt,
  editQueuedInsert as editQueuedInsertIn,
  hasQueuedInsert,
  retryFailed,
  type NewQueueItem,
  type QueueItem,
} from './queueState'

export type { ConflictKind, QueueItem, QueueOperation, QueueStatus } from './queueState'
export { QUEUE_STORAGE_FAILED } from './queueState'

// Where the queue lived before LED-303. Moved into IndexedDB once, then removed.
const LEGACY_QUEUE_KEY = 'ledger_offline_queue'

/** Shown when this browser cannot open the queue at all: offline changes cannot be kept. */
export const QUEUE_UNAVAILABLE = "This browser can't store offline changes, so changes made offline can't be saved."

// The last committed queue, for the synchronous reads (counts, the review sheet, revisionFor).
// Every write goes through IndexedDB first and updates this from what was committed.
let snapshot: QueueItem[] = []
let unavailable: string | null = null
let loading: Promise<void> | null = null

type QueueListener = () => void
const queueListeners = new Set<QueueListener>()

/** Subscribe to queue changes (enqueue, drain, resolve). Returns an unsubscribe fn. */
export function subscribeQueue(cb: QueueListener): () => void {
  queueListeners.add(cb)
  return () => {
    queueListeners.delete(cb)
  }
}

// Other tabs share the stored queue (LED-302): each commit tells them to re-read it, so their
// counts, review sheet and expiry timer follow. The message carries no queue contents.
const QUEUE_CHANNEL = 'ledger_offline_queue'
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(QUEUE_CHANNEL)
if (channel) {
  channel.onmessage = () => {
    readStoredQueue().then(
      (queue) => committed(queue, false),
      (err) => console.error('Failed to re-read the offline queue:', err),
    )
  }
}

function committed(queue: QueueItem[], announce = true): void {
  snapshot = queue
  queueListeners.forEach((cb) => cb())
  if (announce) channel?.postMessage('changed')
}

function readLegacyQueue(): QueueItem[] {
  try {
    const raw = localStorage.getItem(LEGACY_QUEUE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as QueueItem[]) : []
  } catch {
    return []
  }
}

/**
 * Opens the stored queue once, moving a queue kept in localStorage before LED-303 into it. The
 * old copy is removed only after the move commits, and the move skips ids already stored, so a
 * second tab doing the same adds nothing. A failure is kept for `queueUnavailable()` and retried
 * on the next call.
 */
export function loadQueue(): Promise<void> {
  if (!loading) {
    loading = (async () => {
      const legacy = readLegacyQueue()
      try {
        const queue = await mutateStoredQueue((current) => mergeLegacyQueue(current, legacy))
        unavailable = null
        if (legacy.length > 0) {
          try { localStorage.removeItem(LEGACY_QUEUE_KEY) } catch { /* moved; a leftover copy is skipped by id */ }
        }
        committed(queue)
      } catch (err) {
        loading = null
        unavailable = QUEUE_UNAVAILABLE
        queueListeners.forEach((cb) => cb())
        throw err
      }
    })()
  }
  return loading
}

/** Why offline changes cannot be stored in this browser, or null when they can. */
export function queueUnavailable(): string | null {
  return unavailable
}

async function readQueue(): Promise<QueueItem[]> {
  await loadQueue()
  return readStoredQueue()
}

async function mutateQueue(fn: (queue: QueueItem[]) => QueueItem[]): Promise<void> {
  await loadQueue()
  committed(await mutateStoredQueue(fn))
}

/** A queue write for a caller: resolves with an error message instead of throwing. */
async function store(fn: (queue: QueueItem[]) => QueueItem[]): Promise<{ error: string | null }> {
  try {
    await mutateQueue(fn)
    return { error: null }
  } catch (err) {
    console.error('Failed to store the offline queue:', err)
    return { error: QUEUE_STORAGE_FAILED }
  }
}

/** Empties the queue (sign-out, or the user clears it). Rejects when the stored queue could not be cleared. */
export async function clearOfflineQueue(): Promise<void> {
  try { localStorage.removeItem(LEGACY_QUEUE_KEY) } catch { /* nothing to remove */ }
  await mutateQueue((current) => (current.length === 0 ? current : []))
}

/**
 * Stores a change for the next sync. Resolves once it is durable; `error` is set when it could
 * not be stored, and the caller must not show the change as saved (LED-303).
 */
export function enqueue(item: NewQueueItem): Promise<{ error: string | null }> {
  return store((queue) => appendItems(queue, [item], Date.now(), () => crypto.randomUUID()))
}

/** Stores several changes in one write: all of them are kept, or none is (LED-303). */
export function enqueueMany(items: NewQueueItem[]): Promise<{ error: string | null }> {
  if (items.length === 0) return Promise.resolve({ error: null })
  return store((queue) => appendItems(queue, items, Date.now(), () => crypto.randomUUID()))
}

/**
 * Applies an edit to a create that is still in the queue. `edited` is false when no such pending
 * (or failed) create exists, so the caller queues an ordinary update instead (LED-193).
 */
export async function editQueuedInsert(
  rowId: string,
  values: Record<string, unknown>,
): Promise<{ edited: boolean; error: string | null }> {
  let edited = false
  const { error } = await store((queue) => {
    const result = editQueuedInsertIn(queue, rowId, values)
    edited = result.edited
    return result.queue
  })
  return { edited: !error && edited, error }
}

/**
 * The revision a queued change to this row is made against. A row that is still a queued create
 * has none yet (its cached updated_at is the device's guess); the drain gives it the insert's.
 */
export function revisionFor(table: string, row: { id: string; updated_at?: string } | undefined): string | undefined {
  if (!row || hasQueuedInsert(snapshot, table, row.id)) return undefined
  return row.updated_at
}

type SyncedListener = (item: QueueItem) => void
const syncedListeners = new Set<SyncedListener>()

/** Hears each queued insert as the drain saves it. Mount one owner only (AppLayout), or a follow-up runs twice. */
export function registerSyncedListener(cb: SyncedListener): () => void {
  syncedListeners.add(cb)
  return () => {
    syncedListeners.delete(cb)
  }
}

/** Items still waiting to sync (excludes conflicted and expired items). */
export function pendingCount(): number {
  return snapshot.filter(isPending).length
}

/** Items the user must review: conflicted or expired. */
export function flaggedCount(): number {
  return snapshot.filter(isFlagged).length
}

/** Items that hit a database error too many times and need a Retry or a discard. */
export function failedCount(): number {
  return snapshot.filter((item) => item.status === 'failed').length
}

export function listQueue(): QueueItem[] {
  return snapshot
}

/** Keep the local edit: it is retried on the next drain, bypassing the conflict check. */
export function keepMine(id: string): Promise<{ error: string | null }> {
  return store((queue) => applyKeepMine(queue, id, Date.now()))
}

/** Keep the server version, or discard a failed item: drop it (and any pending receipt blob). */
export async function keepTheirs(id?: string): Promise<void> {
  await discardFlagged(deps, id)
}

/** Retry a failed item: it becomes pending again with a fresh attempt count. */
export function retryFailedItem(id: string): Promise<{ error: string | null }> {
  return store((queue) => retryFailed(queue, id))
}

/** Flags items that have passed the max age. Called on a timer so an offline item flags without waiting for a drain. */
export async function expireQueueNow(): Promise<void> {
  if (expireNow(snapshot, Date.now()) === snapshot) return
  await store((queue) => expireNow(queue, Date.now()))
}

/** The earliest moment a pending item will expire, or null when nothing is pending. */
export function nextQueueExpiry(): number | null {
  return nextExpiryAt(snapshot)
}

const deps: DrainDeps = {
  client: supabase as unknown as DrainClient,
  readQueue,
  mutateQueue,
  receipts: {
    prefix: PENDING_RECEIPT_PREFIX,
    get: getPendingReceipt,
    remove: removePendingReceipt,
    buildPath: buildReceiptObjectPath,
  },
  now: Date.now,
  onSynced: (item) => syncedListeners.forEach((cb) => cb(item)),
}

/**
 * Replays all pending operations against Supabase in order (see drainWith).
 * Only one drain runs at a time: a second call while one is running shares its result
 * instead of starting another, so two triggers can never replay the same items twice.
 * Across tabs the drain holds a Web Lock, so another tab's drain waits and then sends only
 * what is left (LED-302). Follow-ups (`onSynced`) run in the tab that sent the row.
 */
export const drainQueue = singleFlight((onProgress) =>
  exclusive(navigator.locks as LockManagerLike | undefined, 'ledger_queue_drain', () => drainWith(deps, onProgress)),
)
