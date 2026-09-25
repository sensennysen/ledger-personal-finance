# LED-128 · Offline queue: drain race, delete conflicts, failed inserts, expiry, singleton — retro (2026-09-25)

## What shipped
- The drain moved to `src/lib/queueDrain.ts` (`drainWith`, `discardFlagged`, `singleFlight`) with the supabase client, queue storage and receipt store passed in. `offlineQueue.ts` wires the real ones. This is what makes `drainQueue` and `keepTheirs` testable under `node --test`.
- `queueState.ts` gained the `failed` status, `conflictKind` (`edited` | `deleted`), a `serverSnapshot`, `attempts`/`lastError`, and the pure helpers `recordFailure`, `retryFailed`, `expireNow`, `nextExpiryAt`, `describeConflict`, `canKeepMine`, `isCountableError`.
- Drain behaviour: an update to a row the server deleted is a `conflict` (`deleted`), both when the pre-check finds no row and when the update touches zero rows. A delete of a row already gone counts as synced; a delete of a row edited since is a `conflict`. Insert, update and delete database errors count attempts and flag `failed` after 5. A dropped connection (error with no code) never counts.
- `NetworkStatusProvider` (`src/contexts/NetworkStatusContext.tsx`, mounted in `AppLayout`) owns the listeners and the drain trigger; `useNetworkStatus()` is a context read. The provider also sets one timer for the next expiry and re-checks on `visibilitychange`.
- Review sheet: per-field "yours / theirs" for an edited conflict, "Deleted on another device" with Discard only, and Retry / Discard for a failed item. Banner says "couldn't be saved" when every flagged item is failed.
- Reordering accounts or categories offline returns "Connect to the internet to change the order." and both pages show it on the notification surface (`AccountsPage` and `CategoriesPage` used to drop the result).
- Tests: `tests/queueDrain.test.mjs` (24 cases) on a new harness in `tests/helpers/`, plus 7 cases in `tests/offlineQueue.test.mjs`.

## Decisions
- **The drain race was mostly already fixed.** `mergeDrainResult` re-reads the queue before writing, so within one tab nothing enqueued or resolved mid-drain is lost. What was still open was two drains at once (a stale `isSyncing` closure, a second hook instance). `singleFlight` plus a ref in the provider closes that; the tests cover both.
- **Keep mine is not offered for an update to a deleted row.** With no row there is nothing to overwrite, and re-creating it from a partial payload would invent data.
- Conflict and expired items keep their LED-05 colours; only pending (gold) and failed (red) were set here.

## Acceptance criteria
- (a) A drain never overwrites an item enqueued or resolved mid-drain: PASS (unit tests, both keep-theirs and keep-mine mid-drain).
- (b) Update to a deleted row is a conflict, not synced: PASS (unit tests; live: seeded queue against a row deleted with psql, ended as `conflict` / `deleted`).
- (c) Delete conflicts are detected with keep mine or keep theirs: PASS by unit test. Live, only the already-gone delete (synced) was exercised.
- (d) Repeated database errors move an item to failed and show it in the banner and sheet: PASS live. A bad insert went pending 1 to 4, then `failed` on the 5th drain, showed "Couldn't save after 5 tries" with Retry and Discard, and was not retried again.
- (e) Items flag as expired on the clock, not only on a drain: PASS live. A pending item 20 s from the limit was still pending at 9 s and `expired` at 18 s with no drain, and the banner switched.
- (f) The sheet shows changed fields: PASS live ("Notes: yours mine, theirs empty; Amount: yours 55, theirs 60").
- (g) useNetworkStatus is provided once and a second consumer cannot start a second drain: PASS live and by test. Three `online` events in one tick sent one insert and wrote one row.
- (h) Reorder while offline says so: PARTIAL. Hook returns the message and both pages notify; not seen in the browser (see Backlog).
- (i) A mock harness covers `drainQueue` and `keepTheirs`: PASS.
- (j) Lint, build and test pass: PASS (541/541).
- Also live: Keep mine wrote amount 55 and notes "mine" to the server row; Discard flagged emptied the queue.

## Backlog
- Reorder offline not seen live. On the Accounts page at 1024 px the Move arrows are `hidden` outside the flat rearrange mode and every "Move … down" was disabled, so the path could not be driven. Enter rearrange mode (or drag) offline and confirm the "Couldn't change the order" notification.
- The account **group** reorder in `AccountsPage` (`profiles.account_group_order`) still returns early offline with no message.
- Live checks seeded the queue through `localStorage` and did not go through the edit dialog while offline, so the enqueue side (`updateTransaction` offline) was not re-run.
- A delete conflict (`edited` on a queued delete) was covered by unit test only.
- The sheet still titles items without a `description`/`name` as the table name ("transactions"). Not new.
- While any item is flagged the banner shows only the flagged message, so pending items behind it (the bad insert at attempts 1 to 4) have no count on screen. Pre-existing precedence.
- The 30-day expiry timer is per-tab; two tabs each set their own and both write the same result.
