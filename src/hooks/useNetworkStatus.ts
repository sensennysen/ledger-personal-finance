import { useEffect, useState, useCallback } from 'react'
import { drainQueue, flaggedCount, keepMine, keepTheirs, pendingCount, subscribeQueue } from '@/lib/offlineQueue'

interface NetworkStatus {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  /** Conflicted or expired items awaiting the user's keep-mine / keep-theirs decision */
  flaggedCount: number
  /** Manually trigger a sync attempt */
  syncNow: () => Promise<void>
  /** Re-read the pending count from storage */
  refreshCount: () => void
  /** Resolve a flagged queue item */
  resolve: (id: string, choice: 'mine' | 'theirs') => Promise<void>
}

/**
 * Tracks online/offline status and automatically drains the offline mutation
 * queue whenever the connection is restored.
 */
export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [isSyncing, setIsSyncing] = useState(false)
  const [count, setCount] = useState(() => pendingCount())
  const [flagged, setFlagged] = useState(() => flaggedCount())

  const refreshCount = useCallback(() => {
    setCount(pendingCount())
    setFlagged(flaggedCount())
  }, [])

  const syncNow = useCallback(async () => {
    if (isSyncing) return
    const current = pendingCount()
    if (current === 0) return
    setIsSyncing(true)
    try {
      await drainQueue()
      notifySyncListeners()
    } catch {
      // drainQueue itself failed — count will be refreshed in finally
    } finally {
      // Always refresh the displayed count, even if the drain partially failed
      refreshCount()
      setIsSyncing(false)
    }
  }, [isSyncing, refreshCount])

  useEffect(() => subscribeQueue(refreshCount), [refreshCount])

  const resolve = useCallback(
    async (id: string, choice: 'mine' | 'theirs') => {
      if (choice === 'theirs') {
        await keepTheirs(id)
        notifySyncListeners()
        return
      }
      keepMine(id)
      await syncNow()
    },
    [syncNow]
  )

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      syncNow()
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [syncNow])

  return { isOnline, isSyncing, pendingCount: count, flaggedCount: flagged, syncNow, refreshCount, resolve }
}

// ---------------------------------------------------------------------------
// Singleton store so App-level hook instance can be shared with data hooks
// ---------------------------------------------------------------------------
type SyncListener = () => void
const syncListeners = new Set<SyncListener>()

/** Called by data hooks to register a refetch callback after sync. */
export function registerSyncListener(cb: SyncListener) {
  syncListeners.add(cb)
  return () => syncListeners.delete(cb)
}

/** Called by drainQueue after successful sync to notify data hooks. */
export function notifySyncListeners() {
  syncListeners.forEach((cb) => cb())
}
