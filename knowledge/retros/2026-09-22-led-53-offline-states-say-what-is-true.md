# LED-53 — Offline states say what's true

- `useNetworkStatus()` is **not** a singleton — each call attaches its own
  `online`/`offline` listeners, and the `online` handler calls `syncNow()` →
  `drainQueue()`. Only one call site should ever exist per page (today:
  `AppLayout`). A second instance mounted lower in the tree (tried this
  first for `LoanPurchaseTracker`'s offline gating, reverted) races the
  app-level instance on reconnect: both read the queue before either
  writes it back, so both would replay the same pending items —
  duplicate inserts on the same offline transaction. Any component that
  only needs a reactive `isOnline` boolean for UI gating (disabling a
  button, showing a notice) should use a local listener-only hook instead
  (see `useIsOnline` in `LoanPurchaseTracker.tsx`), not the full hook.
- `--primary`/`--primary-foreground` already resolve to this app's gold M3
  seed color (`#7A5900` light / `#EDC55F` dark) — the design audit's
  "indigo for syncing" complaint predates this token migration. No new
  color tokens were needed to satisfy "gold for pending, red only for
  genuine failure"; only the copy, the missing `Sync now` action, and the
  11px→12px (`text-xs`) type size were actually wrong.
- `drainQueue`'s per-item progress callback (`onProgress`) is I/O-adjacent
  like the rest of the function, so it isn't unit-tested — same gap
  [[LED-05]]'s retro already flagged (no supabase/localStorage mock
  harness exists yet).

## Backlog
- Same `drainQueue` races from the LED-05 backlog are still open; this
  ticket didn't touch drain ordering/merge logic, only added a progress
  callback around the existing loop.
- `DashboardTransactionRow` (dashboard "recent activity") doesn't show the
  new `queued` marker — it's a separate, prop-driven presentational
  component, not `TransactionRow`. Left out of scope; would need its
  caller (`DashboardPage`) to pass a queued indicator through
  `rightDetail`.
- `updateAccountOrder`/`updateCategoryOrder` (drag-reorder) still silently
  no-op offline — not named in the ticket's acceptance criteria, only the
  create/update/delete CRUD paths were in scope.
