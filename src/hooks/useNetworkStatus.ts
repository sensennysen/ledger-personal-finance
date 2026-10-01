import { useContext } from 'react'
import { NetworkStatusContext, type NetworkStatus } from '@/contexts/networkStatusState'

/**
 * Online/offline state and the offline-queue drain. The state lives in one
 * NetworkStatusProvider (mounted in AppLayout), so any number of components can call
 * this without adding a listener or a second drain.
 */
export function useNetworkStatus(): NetworkStatus {
  const status = useContext(NetworkStatusContext)
  if (!status) throw new Error('useNetworkStatus must be used inside NetworkStatusProvider')
  return status
}

// ---------------------------------------------------------------------------
// Sync listeners: data hooks register a refetch to run after a drain or a resolve.
// ---------------------------------------------------------------------------
type SyncListener = () => void
const syncListeners = new Set<SyncListener>()

/** Called by data hooks to register a refetch callback after sync. */
export function registerSyncListener(cb: SyncListener) {
  syncListeners.add(cb)
  return () => syncListeners.delete(cb)
}

/** Called after a sync or a resolve to notify data hooks. */
export function notifySyncListeners() {
  syncListeners.forEach((cb) => cb())
}
