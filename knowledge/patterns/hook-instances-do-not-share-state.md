# Entity reads share one store; a write says what it made stale

Until LED-321 each `useTransactions()` / `useAccounts()` instance kept its own `useState`, so an entry queued from the layout's form never showed on Home (LED-145), the same accounts read ran once per instance, and an online write refreshed only the instance that made it (REV-013). Reads now go through one TanStack Query store (`src/lib/queryClient.ts`), which every instance with the same key shares.

**How:**
1. **Read** through `useEntityQuery` (`src/hooks/useEntityQuery.ts`). The key is `entityKey(userId, entity, params)` from `src/lib/entityQuery.ts`, and every filter the query uses goes in `params`. Keep the existing `dataCache` key as `cacheKey`: the copy is the warm start and what shows offline, and the offline queue's optimistic writes use it.
2. **Write**, then `await invalidateAfterWrite(entity)`. `INVALIDATES` in `src/lib/invalidation.ts` says what each write makes stale (a transaction touches balances, budgets, goals, card payments and loans). Add any new dependency there, not as a refresh call on a page.
3. **An offline optimistic write** is two steps: `queryClient.setQueryData(key, next)` and `writeCache(cacheKey, next)`. Every instance with that key updates. When you change accounts, update both account reads (`includeArchived` false and true).
4. **A hook that reads outside the store** (`useBudgets`, `useLoanPurchases`, a card's payment history) registers `registerEntityListener(entity, refetch)` from `src/lib/cacheEvents.ts`. `invalidateAfterWrite` raises it for every target.
5. **Retries:** leave TanStack's `retry` off. `readWithPolicy` is the only retry policy (`first-load-fails-fast.md`).

**Verify:** in dev, `await import('/src/lib/queryClient.ts')` from the browser console gives the app's own store. `getQueryCache().getAll()` shows observers and `state.dataUpdateCount` per key: one read shared by six instances shows six observers and one update. Do not count raw network events (see the LED-166 retro). To act on the app's `onlineManager`, import the exact `/node_modules/.vite/deps/@tanstack_react-query.js?v=…` URL from `performance.getEntriesByType('resource')`. Importing without the `?v=` gives a second module instance that the app doesn't use.
