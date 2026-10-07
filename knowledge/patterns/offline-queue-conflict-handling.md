# Offline queue: conflicts, expiries and failures
Three layers, so the drain can be tested without Supabase or localStorage (LED-05, LED-128):
- `src/lib/queueState.ts` — pure state helpers (status, expiry, conflict fields, attempt counting).
- `src/lib/queueDrain.ts` — the drain itself, with the client, storage and receipt store passed in (`drainWith`, `discardFlagged`, `singleFlight`).
- `src/lib/offlineQueue.ts` — wires the real supabase, the IndexedDB queue (`queueStorage.ts`) and receipt store. Tests use `tests/helpers/fakeSupabase.mjs` and `fakeQueueStore.mjs`.

**Stored before shown (LED-303).** The queue is one record in the IndexedDB database `ledger_offline_queue`. Every change is a `mutateStoredQueue(fn)`: read, change and write in one readwrite transaction, resolved only when it commits. Writers (`enqueue`, `enqueueMany`, `editQueuedInsert`, `keepMine`, `retryFailedItem`) return `{ error }`; an offline save awaits it and updates the screen and balances only after. A failure returns `QUEUE_STORAGE_FAILED` and nothing is shown. The synchronous reads (counts, `listQueue`, `revisionFor`) use a snapshot of the last commit. `loadQueue()` moves a pre-LED-303 localStorage queue in once (`mergeLegacyQueue`, by id) and removes the old key after the move commits. If IndexedDB cannot open, `queueUnavailable()` is set and the offline banner says so in red.
- A batch (bulk delete, bulk category, an import) is one `enqueueMany` write, then one list update and one balance pass (LED-318). Never enqueue a batch row by row: each write re-serialises the whole queue.
- Drain deps are `readQueue()` and `mutateQueue(fn)`, both async. A read-modify-write goes inside `mutateQueue`, never as a read followed by a separate write.

**Statuses.** An item with no status is pending. `conflict` (the server row was edited, or deleted, since it was queued), `expired` (older than 30 days) and `failed` (a database error five times) are flagged: the drain skips them until the user decides. Flagged items sort first after a drain and pending order is preserved.
- Update to a deleted row: `conflict` with `conflictKind: 'deleted'`. Only Discard is offered; there is nothing left to overwrite.
- Delete of an already-deleted row counts as synced. Delete of a row edited since is a `conflict`.
- Only a database error carrying a `code` counts toward `failed`. A dropped connection never does.
- Expiry flags on a timer in `NetworkStatusProvider`, not only on the next drain.

**Tabs share one queue (LED-302).** Each commit posts `changed` on the BroadcastChannel `ledger_offline_queue`; other tabs re-read the stored queue into their snapshot and fire their listeners. `drainQueue` holds the Web Lock `ledger_queue_drain` (`exclusive`), so a second tab's drain waits and sends only what is left. `onSynced` follow-ups run in the tab that sent the row. Without Web Locks the drain runs unlocked and relies on idempotent inserts and revisions. Test with `fakeLocks()` and one `fakeQueueStore` shared by two `singleFlight` drains.

**Drains on its own (LED-305).** `NetworkStatusProvider` calls `autoSync` once the queue has loaded, on `online`, and on focus or the tab becoming visible; `shouldDrain` (in `syncReadiness.ts`) decides. A drain that leaves items pending while online retries after 5 s, 30 s and 2 min, then waits for the next trigger. Two tabs opening at once both call it, and the drain lock makes the second find nothing to send.

- A drain that saved rows posts `synced`, and other tabs run `notifySyncListeners` (`subscribeRemoteSync`), so their lists re-read as after their own drain. Without it the other tab's count cleared but its rows stayed "queued".

**A cache write can fail; do not announce one that did (LED-303).** `writeCache` returns false on a quota error. `updateTransactionCache` notifies other instances only when the write landed: they reload from the cache, so announcing a failed write reloads the old list over the new row in every instance, this one included.

**Check the queue live in the browser.** Under Vite, `await import('/src/lib/offlineQueue.ts')` from the console loads a second copy of the module, because the app's copy has an HMR `?t=` suffix. Take the app's URL from `performance.getEntriesByType('resource')`. Two browser-pane tabs share IndexedDB, BroadcastChannel and Web Locks, which is enough for the two-context check. Stub `Navigator.prototype.onLine` and dispatch `offline`/`online` (item 15 of `browser-check-with-local-user.md`).

**One drain at a time.** `drainQueue` is wrapped in `singleFlight`, and `mergeDrainResult` re-reads the queue before writing so items enqueued or resolved mid-drain survive.

**`useNetworkStatus()` reads one provider.** `NetworkStatusProvider` (mounted in `AppLayout`) owns the `online`/`offline` listeners and the drain trigger; the hook is a context read, so a second call site adds nothing. `useIsOnline()` in `LoanPurchaseTracker.tsx` predates this and is still a plain listener.

**Colour.** Pending is gold; red is for a genuine failure. Conflict and expired keep their LED-05 treatment.

**Not queued:** reordering accounts or categories (one write per row) and splitting a transaction. Both refuse offline with a message.

**A queued create is edited in the queue (LED-193).** An offline create is given its row id on the device (`payload.id`), and `editQueuedInsert` merges a later edit into that queued insert (a `failed` one becomes pending again). Queuing an update instead would target a row the database has never seen, and it would be flagged as deleted. `drainWith` calls `deps.onSynced(item)` for each saved insert; `registerSyncedListener` in `offlineQueue.ts` lets one owner (AppLayout) run follow-up steps, such as a card payment's statement, once per row. Register one listener only, or the follow-up runs twice.

**A queued change is made against a revision (LED-297).** Updates and deletes carry `baseRevision`, the server's `updated_at` the edit was made against, and are sent in one request filtered `.eq('updated_at', baseRevision)`, so the check and the write are one statement. Zero rows back means a re-read decides: gone (an update becomes conflict `deleted`, a delete is synced) or edited (conflict). A failed read keeps the item pending with `SERVER_CHECK_FAILED` and writes nothing. Items without a revision (queued before LED-297) read first, then write against the revision they read. `force` (Keep mine) is the only unconditional write.
- Optimistic rows keep the server's `updated_at`; never stamp `new Date()` on a cached row, or the next edit's base is a guess.
- `RevisionMoves` records the drain's own writes; `rebaseRevision` moves later changes to the same row onto them, in the loop and in the merge.
- `revisionFor(table, row)` gives none to a row that is still a queued create. It takes the insert's revision, and waits while that insert is unsent (`unsentRows`).

**Inserts replay idempotently (LED-298).** Every queued create carries its own `payload.id` (imports too). A `23505` on `<table>_pkey` re-reads by id and owner: our row means the earlier send committed, so it is synced once; anything else is a countable failure.

**Versions (LED-299).** `editQueuedInsert` bumps `version`. The drain records what it sent (`SentInsert`); `mergeDrainResult` turns a newer version of a sent create into an update of the changed fields (`followUpUpdate`), and keeps the newer copy of a kept one.

**Receipts are a job of their own (LED-300, LED-301).** Any create or edit can carry a `pending-receipt:` marker. The drain uploads, writes the path to the stored item (`setResolvedReceipt`, no version bump) and only then removes the local file. A thrown error keeps the item as far as it got. `uploadedReceipt` marks a file the drain uploaded; discarding the item deletes it from storage. An online save whose upload fell back to the local copy saves the row without the marker (`splitPendingReceipt`) and queues the receipt as an edit against the saved revision. A marker is never written to the database.

**Show what a pending item is waiting on.** `itemNote` shows a pending item's `lastError` when it has no attempts (the check-failed case). A new reason to keep an item pending needs a note here too, or the sheet only says "Edit · Transaction".

**Check the drain live from Node.** `queueDrain.ts` is pure, so a scratchpad script can import it with the real supabase-js client (`createRequire(<repo>/package.json)`), sign in as the seed's demo user and run `drainWith` against local PostgREST and Storage. That proves the timestamp filter round-trip, zero-row responses and the `23505` message without a browser. Wrap `client.from(t).insert` to hold or throw a request mid-drain.
