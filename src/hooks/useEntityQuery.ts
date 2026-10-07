import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { describeQueryError, entityKey, entityQueryOptions, type Entity, type ReadResult } from '@/lib/entityQuery'
import { offlineNoCopyMessage, offlineUnavailable } from '@/lib/readState'
import type { DataErrorContext } from '@/lib/dataErrors'

interface UseEntityQueryInput<T> {
  entity: Entity
  /** The read's parameters, part of its key: two reads share a request only when these match. */
  params?: Record<string, unknown>
  /** The dataCache key for this user. */
  cacheKey: (userId: string) => string
  read: (userId: string, retry: boolean, signal: AbortSignal) => PromiseLike<ReadResult<T>>
  /** Names the list in the offline message, e.g. "your accounts" (LED-307). */
  offlineLabel: string
  /** False reads nothing and reports not loading (a filter that is not known yet). */
  enabled?: boolean
  context?: DataErrorContext
}

/**
 * A user's entity read through the shared store (LED-321). Every hook instance with the same key
 * shares one request, one copy of the rows and one loading and error state.
 * `data` is undefined until there is a copy or a successful read.
 *
 * Offline with no copy on this device is reported as an error naming what is missing, never as
 * endless loading, so list views resolve it through resolveLoadState; the read resumes on reconnect.
 */
export function useEntityQuery<T>({ entity, params, cacheKey, read, offlineLabel, enabled = true, context }: UseEntityQueryInput<T>) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const paramsKey = JSON.stringify(params ?? null)
  // Rebuilt only when the user or the parameters change, so the key stays stable between renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const queryKey = useMemo(() => entityKey(userId ?? '', entity, params), [userId, entity, paramsKey])
  const storageKey = userId ? cacheKey(userId) : ''

  const query = useQuery({
    ...entityQueryOptions<T>({
      queryKey,
      cacheKey: storageKey,
      read: (retry, signal) => read(userId!, retry, signal),
      context,
    }),
    enabled: enabled && userId !== null,
  })

  const active = enabled && userId !== null
  const offline = active && offlineUnavailable({ hasData: query.data !== undefined, paused: query.fetchStatus === 'paused' })
  const failure = offline ? { message: offlineNoCopyMessage(offlineLabel), detail: null } : describeQueryError(query.error)
  const { refetch: refetchQuery } = query
  const refetch = useCallback(async () => { await refetchQuery() }, [refetchQuery])

  return {
    data: query.data,
    // Pending is "nothing to show yet"; a refresh behind a copy on screen is not loading.
    loading: active && query.isPending && !offline,
    error: failure?.message ?? null,
    errorDetail: failure?.detail ?? null,
    offline,
    refetch,
    queryKey,
    cacheKey: storageKey,
  }
}
