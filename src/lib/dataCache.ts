const PREFIX = 'ledger_cache:'
// Default TTL: 24 hours. Cache is a warm-start hint; fresh data always wins.
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

export function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry<T>
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(PREFIX + key)
      return null
    }
    return entry.data
  } catch {
    return null
  }
}

/** Returns false when the copy could not be written (quota): a reader of the cache will not see `data`. */
export function writeCache<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): boolean {
  try {
    const entry: CacheEntry<T> = { data, expiresAt: Date.now() + ttlMs }
    localStorage.setItem(PREFIX + key, JSON.stringify(entry))
    return true
  } catch {
    // Storage quota exceeded: the cache is a warm-start hint, so the app carries on without it.
    return false
  }
}

/** Remove all cache entries that start with the given prefix (e.g. a user id). */
export function clearCacheByPrefix(prefix: string): void {
  const toRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(PREFIX + prefix)) toRemove.push(k)
  }
  toRemove.forEach((k) => localStorage.removeItem(k))
}
