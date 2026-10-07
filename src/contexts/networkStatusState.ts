import { createContext } from 'react'

export interface NetworkStatus {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  /** Conflicted, expired or failed items awaiting the user's decision */
  flaggedCount: number
  /** The failed subset of flaggedCount: shown as a real failure, not a pending review. */
  failedCount: number
  /** How many of this drain's items have been attempted so far, and the drain's total. Null when not syncing. */
  syncProgress: { done: number; total: number } | null
  /** Why this browser cannot store offline changes, or null when it can (LED-303). */
  storageError: string | null
  /** Manually trigger a sync attempt */
  syncNow: () => Promise<void>
  /** Re-read the counts from storage */
  refreshCount: () => void
  /** Resolve a flagged queue item */
  resolve: (id: string, choice: 'mine' | 'theirs') => Promise<void>
  /** Make a failed item pending again and sync */
  retry: (id: string) => Promise<void>
}

export const NetworkStatusContext = createContext<NetworkStatus | null>(null)
