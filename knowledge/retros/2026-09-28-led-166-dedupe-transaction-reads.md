# LED-166 · Every route reads the whole transaction history several times — retro (2026-09-28)

## What shipped
- `src/lib/inFlightRequest.ts` (new): `dedupeAsync(key, run)`, a module-level `Map<string, Promise>` — a call sharing a key with one already in flight returns the same promise; the entry clears on settle (success or failure), so a later call always goes to the network fresh.
- `useTransactions.ts`'s `fetch()` wraps its table read (both the `limit` branch and the paged branch) in `dedupeAsync(cacheKey, ...)`. `cacheKey` already encodes user + every filter field, so only calls with identical filters collapse; each instance still resolves its own `setTransactions`/`writeCache`/error state from the shared result.

## Acceptance (live re-run: headless Chrome over CDP, seeded 2,000-row account, cold cache — localStorage and caches cleared, service worker unregistered before each navigation)
- (a) Reports, Home, Budgets and Activity each make at most two full-history reads, down from 4-5: **PASS, live, verified from the app's own dedupe hit/miss, not from raw network-request counts.**
  - Home / Dashboard: 1 read (AppLayout's unfiltered call + DashboardPage's unfiltered call collapsed to one `MISS` + one `HIT` on `<user>:transactions:{}`).
  - Activity: 1 read (AppLayout + TransactionsPage collapsed).
  - Reports: 1 read (AppLayout + ReportsPage collapsed).
  - Budgets: 2 reads — AppLayout's unfiltered call, and `BudgetsPage`'s own `categoryId`/`type`-filtered call, which correctly has a different cache key and does *not* collapse with it (a different query, not a duplicate).
  - **Why not from Network-domain counts:** this headless Chrome build (`Chrome/153`, `--headless=new`) reports every request to `/rest/v1/transactions` *twice*, under two different `requestId` formats (a 32-hex id and a `NNNNN.NNN`-style id), on the same page target. A naive `Network.responseReceived` count showed 6-10 requests per route even after the fix, which would read as "not deduped" — it's a measurement artifact, confirmed by adding a one-line trace to `dedupeAsync` itself (removed before commit) and by the request pairs' near-identical timestamps and identical query strings. **Route any future check like this through the app's own signal (a temporary log, or a counter the app already exposes) rather than trusting raw CDP `Network` event counts in this environment.**
  - Also confirmed live, separately: `useSavingsGoals` and `useOverspending`/`useBudgets` make their own, unrelated reads of `transactions` with different select shapes — out of this ticket's stated scope (it names `useTransactions.ts`), unaffected either way, and not part of the "4-5 duplicate reads" this ticket fixed.
- (b) totals still equal SQL: not independently re-checked this session (unchanged code path — `dedupeAsync` only shares the raw `{rows, error}` result; each instance still writes and sums its own state exactly as before). Covered by the existing `pagedRead.test.mjs`/`transactionWindow.test.mjs` totals tests, not a new live SQL comparison.
- (c) a failed read still shows the error state and Retry: **PASS by inspection** — every instance still calls `describeDataError`/`setLoadFailure` from the shared result independently; `dedupeAsync` does not swallow or transform the error.
- (d) offline queue and queued markers still work: **PASS by inspection** — `dedupeAsync` wraps only the *online* read branch (`if (!navigator.onLine) return` still returns before it); `notifyTransactionsRefresh`/`registerTransactionsListener` (`knowledge/patterns/hook-instances-do-not-share-state.md`) are untouched. Not re-run live with `Network.emulateNetworkConditions`.

## Backlog
- (b) and (d) above are inspection-only this session; re-run live if this area gets touched again (SQL-total comparison per `knowledge/patterns/browser-check-with-local-user.md` item 14, offline queue check per item 15).
- Contributed the "headless Chrome double-reports Network events" note to LED-164's retro too, since the same measurement session hit it there first.
