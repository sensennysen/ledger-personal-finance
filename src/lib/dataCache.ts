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

export function writeCache<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
  try {
    const entry: CacheEntry<T> = { data, expiresAt: Date.now() + ttlMs }
    localStorage.setItem(PREFIX + key, JSON.stringify(entry))
  } catch {
    // Storage quota exceeded — silently skip
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
