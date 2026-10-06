// When the app drains the offline queue on its own (LED-305): on opening, on coming back to the
// tab, and a few bounded retries after a drain that left items pending. The provider is mounted
// only for a signed-in user, so being signed in is not a separate input.

export interface SyncReadiness {
  /** The stored queue has been opened (and any old localStorage queue moved in). */
  ready: boolean
  online: boolean
  /** Items waiting to sync; flagged items do not count. */
  pending: number
  /** A drain is already running in this tab. */
  syncing: boolean
}

export function shouldDrain({ ready, online, pending, syncing }: SyncReadiness): boolean {
  return ready && online && pending > 0 && !syncing
}

/** Waits before the automatic retries after a drain left items pending; then it stops until the next trigger. */
export const RETRY_DELAYS_MS = [5_000, 30_000, 120_000] as const

/** The wait before automatic retry number `attempt` (from 0), or null when retries are used up. */
export function retryDelay(attempt: number): number | null {
  return RETRY_DELAYS_MS[attempt] ?? null
}
