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
