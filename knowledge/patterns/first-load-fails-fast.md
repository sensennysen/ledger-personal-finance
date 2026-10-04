# A first load fails fast; a refresh keeps the library retries
supabase-js (postgrest-js 2.116) retries a failed GET three times, waiting 1, 2 and 4 s. A page with nothing to show waited about 8 s before its error appeared (LED-92, LED-242).
**Why:** The retry is right for a background refresh, because the cached rows stay on screen and nobody waits. It is wrong for a first load, where the user is looking at a skeleton. The library offers `.retry(false)` per query, but no retry count.
**How:**
1. Wrap the read in `readWithPolicy((retry) => query.retry(retry), { background })` (`src/lib/readRetry.ts`). For a paged read, apply `.retry(retry)` inside `readAllPages`' `fetchPage`, so every page follows it.
2. `background` means there is data on screen already: `cached !== null` for hooks with a `dataCache` entry, or a `loadedOnce` ref for hooks without one (`useOverspending`, `useSavedFilters`).
3. A first load runs once with retries off. Only on a connection failure (`classifyDataError` is `'connection'`) does it wait 1 s and try once more. A refused or invalid read (RLS, a bad filter) fails at once.
4. Do not add a time limit. A slow 2,000-row read that is working must not become an error.
5. Check the reads a page waits on before its own. Budgets waits for the profile (deficit setting) and the exchange rates, so those reads need the policy too, or the page still takes 8 s.
6. Measure with CDP `Network.setBlockedURLs` (`*rest/v1/*`) after clearing `ledger_cache:*`. An in-page `fetch` override does not work here: navigating inside the app doesn't refetch mounted hooks, and a reload drops the override.
