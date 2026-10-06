import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  drainQueue,
  expireQueueNow,
  failedCount as readFailedCount,
  flaggedCount as readFlaggedCount,
  keepMine,
  keepTheirs,
  loadQueue,
  nextQueueExpiry,
  pendingCount as readPendingCount,
  queueUnavailable,
  retryFailedItem,
  subscribeQueue,
} from '@/lib/offlineQueue'
import { notifySyncListeners } from '@/hooks/useNetworkStatus'
import { retryDelay, shouldDrain } from '@/lib/syncReadiness'
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
  const [storageError, setStorageError] = useState<string | null>(() => queueUnavailable())
  // A ref, not the isSyncing state: two triggers in one tick would both see the stale false.
  const syncing = useRef(false)
  const queueReady = useRef(false)
  const retryAttempt = useRef(0)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // The retry timer calls the current autoSync through this ref (a callback cannot name itself).
  const retryLater = useRef<() => void>(() => {})

  const refreshCount = useCallback(() => {
    setCount(readPendingCount())
    setFlagged(readFlaggedCount())
    setFailed(readFailedCount())
    setStorageError(queueUnavailable())
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

  /**
   * Drains without the user asking (LED-305): when the app opens online with items waiting, when
   * the tab comes back, and on reconnect. A drain that leaves items pending while online retries
   * a few times (retryDelay). Another tab's drain holds the queue lock, so this one waits and
   * finds nothing left to send.
   */
  const autoSync = useCallback(async () => {
    clearTimeout(retryTimer.current)
    const ready = { ready: queueReady.current, online: navigator.onLine, pending: readPendingCount(), syncing: syncing.current }
    if (!shouldDrain(ready)) return
    await syncNow()
    if (!navigator.onLine || readPendingCount() === 0) {
      retryAttempt.current = 0
      return
    }
    const delay = retryDelay(retryAttempt.current++)
    if (delay !== null) retryTimer.current = setTimeout(() => retryLater.current(), delay)
  }, [syncNow])

  useEffect(() => {
    retryLater.current = () => void autoSync()
  }, [autoSync])

  // The queue opens asynchronously (IndexedDB); the counts start at 0 and catch up once it has.
  // A failure is kept by the queue and shown through storageError.
  useEffect(() => {
    let active = true
    loadQueue().then(
      () => {
        queueReady.current = true
        if (active) void autoSync()
      },
      (err) => console.error('Failed to open the offline queue:', err),
    )
    return () => {
      active = false
    }
  }, [autoSync])

  // Coming back to the app is a fresh chance: the retry count starts over.
  useEffect(() => {
    const comeBack = () => {
      if (document.visibilityState !== 'visible') return
      retryAttempt.current = 0
      void autoSync()
    }
    window.addEventListener('focus', comeBack)
    document.addEventListener('visibilitychange', comeBack)
    return () => {
      window.removeEventListener('focus', comeBack)
      document.removeEventListener('visibilitychange', comeBack)
      clearTimeout(retryTimer.current)
    }
  }, [autoSync])

  // An offline item flags as expired when the clock passes the limit, not only on the next drain.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      clearTimeout(timer)
      const at = nextQueueExpiry()
      if (at === null) return
      timer = setTimeout(() => {
        void expireQueueNow().finally(schedule)
      }, Math.min(Math.max(at - Date.now(), 0), MAX_TIMEOUT_MS))
    }
    const recheck = () => {
      void expireQueueNow().finally(schedule)
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
      // A failed write leaves the item flagged, as it was.
      const { error } = await keepMine(id)
      if (!error) await syncNow()
    },
    [syncNow]
  )

  const retry = useCallback(
    async (id: string) => {
      const { error } = await retryFailedItem(id)
      if (!error) await syncNow()
    },
    [syncNow]
  )

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      retryAttempt.current = 0
      void autoSync()
    }
    const handleOffline = () => {
      setIsOnline(false)
      clearTimeout(retryTimer.current)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [autoSync])

  const value = useMemo<NetworkStatus>(
    () => ({
      isOnline,
      isSyncing,
      pendingCount: count,
      flaggedCount: flagged,
      failedCount: failed,
      syncProgress,
      storageError,
      syncNow,
      refreshCount,
      resolve,
      retry,
    }),
    [isOnline, isSyncing, count, flagged, failed, syncProgress, storageError, syncNow, refreshCount, resolve, retry]
  )

  return <NetworkStatusContext.Provider value={value}>{children}</NetworkStatusContext.Provider>
}
