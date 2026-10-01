// Several hook instances (AppLayout, the page, palette hooks, dashboard
// cards) can call the same read with the same key in the same tick — each
// currently pages the whole table independently (LED-166). This collapses
// concurrent calls sharing a key into one underlying request; each caller
// still gets the resolved value and handles it itself (its own cache write,
// its own error state).
const inFlight = new Map<string, Promise<unknown>>()

/**
 * Runs `run()` and shares its result with any other call made with the same
 * `key` while it is still pending. The entry is removed once it settles
 * (success or failure), so the next call — whether a retry after an error or
 * a fresh read once the previous one resolved — always goes to `run` again.
 */
export function dedupeAsync<T>(key: string, run: () => Promise<T>): Promise<T> {
  const pending = inFlight.get(key)
  if (pending) return pending as Promise<T>

  const promise = run().finally(() => {
    inFlight.delete(key)
  })
  inFlight.set(key, promise)
  return promise
}
