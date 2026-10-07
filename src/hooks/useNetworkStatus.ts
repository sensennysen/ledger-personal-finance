import { useContext } from 'react'
import { NetworkStatusContext, type NetworkStatus } from '@/contexts/networkStatusState'
import { invalidateAfterWrite } from '@/hooks/useEntityQuery'

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
// After a drain or a resolve, every read a transaction touches refetches wherever it is mounted:
// lists, balances, budgets, goals and card views (LED-306).
// ---------------------------------------------------------------------------

/** Called after a sync or a resolve (this tab's or another's) to refresh what the queue changed. */
export function notifySyncListeners() {
  void invalidateAfterWrite('sync')
}
