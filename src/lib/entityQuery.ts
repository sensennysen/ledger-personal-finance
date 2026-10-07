// One read policy for every entity (LED-321). Pure: the hooks pass the query in, so node --test
// runs this against a real QueryClient without Supabase or the `@/` alias.

import { readCache, writeCache } from './dataCache.ts'
import { describeDataError, type DataErrorContext, type DescribedError } from './dataErrors.ts'
import { readWithPolicy } from './readRetry.ts'

/** Everything the app reads through the shared store; also the targets of invalidation (LED-306). */
export type Entity =
  | 'accounts'
  | 'categories'
  | 'transactions'
  | 'savings-goals'
  | 'card-payments'
  | 'exchange-rates'

/**
 * `['ledger', userId, entity]`, plus the read's parameters (a filter, `includeArchived`). One user's
 * key never matches another's, and the three-part prefix names every read of an entity.
 */
export function entityKey(userId: string, entity: Entity, params?: Record<string, unknown>): readonly unknown[] {
  return params === undefined ? ['ledger', userId, entity] : ['ledger', userId, entity, params]
}

type RawError = Parameters<typeof describeDataError>[0]

/** What a read hands back: Supabase's `{ data, error }`, or pagedRead's rows mapped onto it. */
export interface ReadResult<T> {
  data: T | null
  error: RawError
}

/** A failed read, carrying the sentence the screen shows and the raw text. */
export class EntityReadError extends Error {
  readonly described: DescribedError

  constructor(described: DescribedError) {
    super(described.message)
    this.name = 'EntityReadError'
    this.described = described
  }
}

/** The copy a read keeps on this device: the warm start on mount and what shows offline. */
export interface EntityCache {
  read: <T>(key: string) => T | null
  write: <T>(key: string, data: T) => boolean
}

const browserCache: EntityCache = { read: readCache, write: writeCache }

interface EntityQueryInput<T> {
  queryKey: readonly unknown[]
  /** The dataCache key, unchanged from before the store so existing copies keep working. */
  cacheKey: string
  /** Must apply `.retry(retry)` to every query (readWithPolicy) and may pass `signal` on. */
  read: (retry: boolean, signal: AbortSignal) => PromiseLike<ReadResult<T>>
  context?: DataErrorContext
  cache?: EntityCache
}

/**
 * Query options shared by every entity read:
 * - the device's copy shows at once, and is always refetched (it is a warm start, not the truth);
 * - a first load fails fast, a refresh with a copy on screen keeps the library retries (LED-242);
 * - the copy is rewritten only by a read that succeeded and was not cancelled;
 * - a failure becomes an EntityReadError with the sentence to show.
 */
export function entityQueryOptions<T>({ queryKey, cacheKey, read, context = { action: 'load' }, cache = browserCache }: EntityQueryInput<T>) {
  return {
    queryKey,
    queryFn: async ({ signal }: { signal: AbortSignal }): Promise<T> => {
      const background = cache.read<T>(cacheKey) !== null
      const { data, error } = await readWithPolicy((retry) => read(retry, signal), { background })
      if (error) throw new EntityReadError(describeDataError(error, context) ?? { message: 'Something went wrong.', detail: null })
      const rows = data as T
      if (!signal.aborted) cache.write(cacheKey, rows)
      return rows
    },
    initialData: () => cache.read<T>(cacheKey) ?? undefined,
    // The copy is older than any read: it shows, and a refetch replaces it straight away.
    initialDataUpdatedAt: 0,
  }
}

/** The sentence and raw text of a store error, whatever threw it. */
export function describeQueryError(error: unknown): DescribedError | null {
  if (!error) return null
  if (error instanceof EntityReadError) return error.described
  return describeDataError(error instanceof Error ? error : String(error), { action: 'load' })
}
