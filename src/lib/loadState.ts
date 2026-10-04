export type LoadState = 'loading' | 'error' | 'stale-error' | 'empty' | 'ready'

interface LoadStateInput {
  loading: boolean
  error: string | null
  hasData: boolean
}

/**
 * Decides what a list view should render. A failed read must never look like
 * "no records": with nothing to show it is an error, with data already on
 * screen it is a non-blocking stale-error.
 */
export function resolveLoadState({ loading, error, hasData }: LoadStateInput): LoadState {
  if (error) return hasData ? 'stale-error' : 'error'
  if (loading && !hasData) return 'loading'
  return hasData ? 'ready' : 'empty'
}

interface RefreshInput {
  loading: boolean
  hasData: boolean
  /** Key of the data on screen (e.g. the cycle month it was read for). */
  dataKey: string | null
  /** Key currently being asked for. */
  requestedKey: string
}

/**
 * Stepping to an uncached key keeps the previous key's data on screen while the
 * new one loads. That data must be marked as belonging to the old key, never
 * passed off as the new one: `pendingKey` names what is loading.
 */
export function resolveRefresh({ loading, hasData, dataKey, requestedKey }: RefreshInput) {
  const refreshing = loading && hasData && dataKey !== null && dataKey !== requestedKey
  return { refreshing, pendingKey: refreshing ? requestedKey : null }
}
