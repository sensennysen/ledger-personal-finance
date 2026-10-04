import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  drainQueue,
  expireQueueNow,
  failedCount as readFailedCount,
  flaggedCount as readFlaggedCount,
  keepMine,
  keepTheirs,
  nextQueueExpiry,
  pendingCount as readPendingCount,
  retryFailedItem,
  subscribeQueue,
} from '@/lib/offlineQueue'
import { notifySyncListeners } from '@/hooks/useNetworkStatus'
import { NetworkStatusContext, type NetworkStatus } from './networkStatusState'

// setTimeout stores its delay in 32 bits; a longer one fires immediately.
const MAX_TIMEOUT_MS = 2 ** 31 - 1

/**
 * The one owner of online/offline state and the queue drain. Every component reads it
 * through useNetworkStatus(), so there is one set of window listeners and one drain trigger.
 */
export function NetworkStatusProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [isSyncing, setIsSyncing] = useState(false)
  const [count, setCount] = useState(() => readPendingCount())
  const [flagged, setFlagged] = useState(() => readFlaggedCount())
  const [failed, setFailed] = useState(() => readFailedCount())
  const [syncProgress, setSyncProgress] = useState<{ done: number; total: number } | null>(null)
  // A ref, not the isSyncing state: two triggers in one tick would both see the stale false.
  const syncing = useRef(false)

  const refreshCount = useCallback(() => {
    setCount(readPendingCount())
    setFlagged(readFlaggedCount())
    setFailed(readFailedCount())
  }, [])

  const syncNow = useCallback(async () => {
    if (syncing.current) return
    const current = readPendingCount()
    if (current === 0) return
    syncing.current = true
    setIsSyncing(true)
    setSyncProgress({ done: 0, total: current })
    try {
      await drainQueue((done, total) => setSyncProgress({ done, total }))
      notifySyncListeners()
    } catch {
      // drainQueue itself failed — count will be refreshed in finally
    } finally {
      // Always refresh the displayed count, even if the drain partially failed
      refreshCount()
      syncing.current = false
      setIsSyncing(false)
      setSyncProgress(null)
    }
  }, [refreshCount])

  useEffect(() => subscribeQueue(refreshCount), [refreshCount])

  // An offline item flags as expired when the clock passes the limit, not only on the next drain.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      clearTimeout(timer)
      const at = nextQueueExpiry()
      if (at === null) return
      timer = setTimeout(() => {
        expireQueueNow()
        schedule()
      }, Math.min(Math.max(at - Date.now(), 0), MAX_TIMEOUT_MS))
    }
    const recheck = () => {
      expireQueueNow()
      schedule()
    }
    schedule()
    const unsubscribe = subscribeQueue(schedule)
    document.addEventListener('visibilitychange', recheck)
    return () => {
      clearTimeout(timer)
      unsubscribe()
      document.removeEventListener('visibilitychange', recheck)
    }
  }, [])

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

  const retry = useCallback(
    async (id: string) => {
      retryFailedItem(id)
      await syncNow()
    },
    [syncNow]
  )

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      void syncNow()
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [syncNow])

  const value = useMemo<NetworkStatus>(
    () => ({
      isOnline,
      isSyncing,
      pendingCount: count,
      flaggedCount: flagged,
      failedCount: failed,
      syncProgress,
      syncNow,
      refreshCount,
      resolve,
      retry,
    }),
    [isOnline, isSyncing, count, flagged, failed, syncProgress, syncNow, refreshCount, resolve, retry]
  )

  return <NetworkStatusContext.Provider value={value}>{children}</NetworkStatusContext.Provider>
}
