# LED-05 — Sync conflicts and expiries

- Ticket path was wrong: banner lives at `src/components/layout/OfflineBanner.tsx`.
- Pure queue logic lives in `src/lib/queueState.ts` because node tests can't load `offlineQueue.ts` (`@/` aliases + supabase). Keep new testable logic there.
- Flagged items sit first in the queue after a drain; pending order is preserved.

## Backlog
- `drainQueue` ends with `writeQueue(remaining)`, clobbering anything enqueued/resolved mid-drain (pre-existing race). Sheet buttons are disabled while syncing as mitigation only.
- Update whose server row was deleted: `maybeSingle` returns null, update hits 0 rows, counted as synced.
- Conflict detection is update-only; delete conflicts undetected.
- Inserts/deletes failing with a DB error retry forever with no failure state.
- No tests for `drainQueue`/`keepTheirs` (need supabase/localStorage mock harness).
- Expiry is only evaluated on drain, so an offline item doesn't flag until the next sync.
- Sheet lacks per-item detail of what changed (mine vs theirs values).
