import { useEffect, useState, useCallback } from 'react'
import { drainQueue, pendingCount } from '@/lib/offlineQueue'

interface NetworkStatus {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  /** Manually trigger a sync attempt */
  syncNow: () => Promise<void>
  /** Re-read the pending count from storage */
  refreshCount: () => void
}

/**
 * Tracks online/offline status and automatically drains the offline mutation
 * queue whenever the connection is restored.
 */
export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [isSyncing, setIsSyncing] = useState(false)
  const [count, setCount] = useState(() => pendingCount())

  const refreshCount = useCallback(() => {
    setCount(pendingCount())
  }, [])

  const syncNow = useCallback(async () => {
    if (isSyncing) return
    const current = pendingCount()
    if (current === 0) return
    setIsSyncing(true)
    try {
      await drainQueue()
      setCount(pendingCount())
      // Notify all registered data hooks to refetch fresh data
      notifySyncListeners()
    } finally {
      setIsSyncing(false)
    }
  }, [isSyncing])

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

  return { isOnline, isSyncing, pendingCount: count, syncNow, refreshCount }
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
