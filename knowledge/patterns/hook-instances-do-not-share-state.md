# Each hook instance has its own copy; an offline write must tell the others

`useTransactions()` is called by the layout (add form), Home, Activity and the account page, and each keeps its own `useState`. An entry queued offline from the layout's form was written to the cache and to that instance only, so Home, already mounted, never showed it (LED-145: the "Not synced yet" marker code was right and invisible).

**Why:** accounts already had `registerAccountsListener`; transactions did not, because Activity remounts after navigation and re-reads the cache. Home does not remount.

**How:**
1. A hook that writes its cache optimistically calls the matching `notify…Refresh()` in `src/lib/cacheEvents.ts`; every instance registers a listener that re-reads its own cache key.
2. Online writes still refetch only in the writing instance. If a screen must update live from another screen's online write, that needs the same event; it was not needed here.
3. Test a marker or a total by making the write from a different component than the one that shows it, with the network off (`Network.emulateNetworkConditions`).
