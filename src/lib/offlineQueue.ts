import { supabase } from './supabase'
import { PENDING_RECEIPT_PREFIX, getPendingReceipt, removePendingReceipt } from './receiptStore'
import { buildReceiptObjectPath } from './receiptUrls'
import { discardFlagged, drainWith, singleFlight, type DrainClient, type DrainDeps } from './queueDrain'
import {
  applyKeepMine,
  expireNow,
  isFlagged,
  isPending,
  nextExpiryAt,
  editQueuedInsert as editQueuedInsertIn,
  hasQueuedInsert,
  retryFailed,
  type QueueItem,
} from './queueState'

export type { ConflictKind, QueueItem, QueueOperation, QueueStatus } from './queueState'

const QUEUE_KEY = 'ledger_offline_queue'

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

type QueueListener = () => void
const queueListeners = new Set<QueueListener>()

/** Subscribe to queue changes (enqueue, drain, resolve). Returns an unsubscribe fn. */
export function subscribeQueue(cb: QueueListener): () => void {
  queueListeners.add(cb)
  return () => {
    queueListeners.delete(cb)
  }
}

function writeQueue(items: QueueItem[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items))
  queueListeners.forEach((cb) => cb())
}

export function clearOfflineQueue(): void {
  localStorage.removeItem(QUEUE_KEY)
  queueListeners.forEach((cb) => cb())
}

export function enqueue(item: Omit<QueueItem, 'id' | 'timestamp'>): void {
  const queue = readQueue()
  queue.push({ ...item, id: crypto.randomUUID(), timestamp: Date.now() })
  writeQueue(queue)
}

/**
 * Applies an edit to a create that is still in the queue. Returns false when no such pending (or
 * failed) create exists, so the caller queues an ordinary update instead (LED-193).
 */
export function editQueuedInsert(rowId: string, values: Record<string, unknown>): boolean {
  const { queue, edited } = editQueuedInsertIn(readQueue(), rowId, values)
  if (edited) writeQueue(queue)
  return edited
}

/**
 * The revision a queued change to this row is made against. A row that is still a queued create
 * has none yet (its cached updated_at is the device's guess); the drain gives it the insert's.
 */
export function revisionFor(table: string, row: { id: string; updated_at?: string } | undefined): string | undefined {
  if (!row || hasQueuedInsert(readQueue(), table, row.id)) return undefined
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
  return readQueue().filter(isPending).length
}

/** Items the user must review: conflicted or expired. */
export function flaggedCount(): number {
  return readQueue().filter(isFlagged).length
}

/** Items that hit a database error too many times and need a Retry or a discard. */
export function failedCount(): number {
  return readQueue().filter((item) => item.status === 'failed').length
}

export function listQueue(): QueueItem[] {
  return readQueue()
}

/** Keep the local edit: it is retried on the next drain, bypassing the conflict check. */
export function keepMine(id: string): void {
  writeQueue(applyKeepMine(readQueue(), id, Date.now()))
}

/** Keep the server version, or discard a failed item: drop it (and any pending receipt blob). */
export async function keepTheirs(id?: string): Promise<void> {
  await discardFlagged(deps, id)
}

/** Retry a failed item: it becomes pending again with a fresh attempt count. */
export function retryFailedItem(id: string): void {
  writeQueue(retryFailed(readQueue(), id))
}

/** Flags items that have passed the max age. Called on a timer so an offline item flags without waiting for a drain. */
export function expireQueueNow(): void {
  const stored = readQueue()
  const next = expireNow(stored, Date.now())
  if (next !== stored) writeQueue(next)
}

/** The earliest moment a pending item will expire, or null when nothing is pending. */
export function nextQueueExpiry(): number | null {
  return nextExpiryAt(readQueue())
}

const deps: DrainDeps = {
  client: supabase as unknown as DrainClient,
  readQueue,
  writeQueue,
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
 */
export const drainQueue = singleFlight((onProgress) => drainWith(deps, onProgress))
