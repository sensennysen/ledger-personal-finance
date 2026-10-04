// How long a read retries before its error shows (LED-242). Pure: the hooks pass the query in.

import { classifyDataError } from './dataErrors.ts'

/** The one wait before a first load tries again after a connection failure. */
export const FIRST_LOAD_RETRY_MS = 1000

/**
 * Runs a read under the retry policy for its kind.
 *
 * A first load (nothing on screen yet, so the page shows its loading state) turns off supabase-js's
 * own GET retries, which wait 1 + 2 + 4 s before giving up, and tries once more after
 * FIRST_LOAD_RETRY_MS, only when the connection failed. A blocked read then shows its error in
 * about 2 s. A refused or invalid read fails at once: retrying it would not help.
 *
 * A background read (data already on screen) keeps the library's retries, since nothing waits on it.
 * No time limit is put on a read: a large read that is slow but working must not become an error.
 *
 * `run(retry)` must apply `.retry(retry)` to every query it makes.
 */
export async function readWithPolicy<R extends { error: unknown }>(
  run: (retry: boolean) => PromiseLike<R>,
  { background, sleep = wait }: { background: boolean; sleep?: (ms: number) => Promise<void> },
): Promise<R> {
  if (background) return run(true)
  const first = await run(false)
  if (!first.error || classifyDataError(first.error as Parameters<typeof classifyDataError>[0]) !== 'connection') return first
  await sleep(FIRST_LOAD_RETRY_MS)
  return run(false)
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
