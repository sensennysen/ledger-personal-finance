# Offline queue: conflicts, expiries and failures
Three layers, so the drain can be tested without Supabase or localStorage (LED-05, LED-128):
- `src/lib/queueState.ts` — pure state helpers (status, expiry, conflict fields, attempt counting).
- `src/lib/queueDrain.ts` — the drain itself, with the client, storage and receipt store passed in (`drainWith`, `discardFlagged`, `singleFlight`).
- `src/lib/offlineQueue.ts` — wires the real supabase, localStorage and receipt store. Tests use `tests/helpers/fakeSupabase.mjs` and `fakeQueueStore.mjs`.

**Statuses.** An item with no status is pending. `conflict` (the server row was edited, or deleted, since it was queued), `expired` (older than 30 days) and `failed` (a database error five times) are flagged: the drain skips them until the user decides. Flagged items sort first after a drain and pending order is preserved.
- Update to a deleted row: `conflict` with `conflictKind: 'deleted'`. Only Discard is offered; there is nothing left to overwrite.
- Delete of an already-deleted row counts as synced. Delete of a row edited since is a `conflict`.
- Only a database error carrying a `code` counts toward `failed`. A dropped connection never does.
- Expiry flags on a timer in `NetworkStatusProvider`, not only on the next drain.

**One drain at a time.** `drainQueue` is wrapped in `singleFlight`, and `mergeDrainResult` re-reads the queue before writing so items enqueued or resolved mid-drain survive.

**`useNetworkStatus()` reads one provider.** `NetworkStatusProvider` (mounted in `AppLayout`) owns the `online`/`offline` listeners and the drain trigger; the hook is a context read, so a second call site adds nothing. `useIsOnline()` in `LoanPurchaseTracker.tsx` predates this and is still a plain listener.

**Colour.** Pending is gold; red is for a genuine failure. Conflict and expired keep their LED-05 treatment.

**Not queued:** reordering accounts or categories (one write per row) and splitting a transaction. Both refuse offline with a message.

**A queued create is edited in the queue (LED-193).** An offline create is given its row id on the device (`payload.id`), and `editQueuedInsert` merges a later edit into that queued insert (a `failed` one becomes pending again). Queuing an update instead would target a row the database has never seen, and it would be flagged as deleted. `drainWith` calls `deps.onSynced(item)` for each saved insert; `registerSyncedListener` in `offlineQueue.ts` lets one owner (AppLayout) run follow-up steps, such as a card payment's statement, once per row. Register one listener only, or the follow-up runs twice.
