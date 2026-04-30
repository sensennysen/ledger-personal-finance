/**
 * Module-level event bus for cross-hook cache invalidation.
 * Used when an offline mutation in one hook needs to trigger a state reload
 * in another hook without going through React context.
 */

type Listener = () => void

const accountsListeners = new Set<Listener>()

export function registerAccountsListener(cb: Listener): () => void {
  accountsListeners.add(cb)
  return () => accountsListeners.delete(cb)
}

export function notifyAccountsRefresh(): void {
  accountsListeners.forEach((cb) => cb())
}
