# LED-160 · Queue review sheet titles items by table name — retro (2026-09-28)

## What shipped
- Root cause was narrower than "no description": a normal transaction edit already submits the whole form (including `description`), so `itemTitle()`'s `payload.description` fallback already worked for that path. The raw `"transactions"` title only showed for a **delete** (`payload: {}`) or a **category-only update** (`payload: { category_id }`) — neither carries a name.
- Added a display-only `label?: string` to `QueueItem` (`queueState.ts`) — never read by `queueDrain.ts` (checked: it only ever passes `.payload` to Supabase's `insert`/`update`), so it can't leak into a write.
- `useTransactions.ts`'s `updateTransaction`, `deleteTransaction`, `bulkDeleteTransactions` and `bulkUpdateCategory` now pass `label: existing.description` (or `tx.description`) from the transaction already in memory at enqueue time.
- Moved `itemTitle`/`itemNote` out of `QueueReviewSheet.tsx` into a new pure `src/lib/queueItemTitle.ts` (AGENTS.md: testable logic lives in `src/lib`), and gave the table-name fallback a `humanizeTable()` map (`transactions` → `Transaction`, `profiles` → `Profile`) with a generic strip-trailing-s + capitalize fallback for anything else, so an unrecognised table is still never shown raw.
- `tests/queueItemTitle.test.mjs` (7 tests): partial-update-falls-back-to-label, delete-keeps-the-name, payload wins when present, unlabelled+no-name falls back to the humanized name (not raw), an unknown table is still singularized/capitalized, a conflict falls back to `serverSnapshot`, and `itemNote` doesn't show a raw table name either.

## Acceptance
- (a) An edited transaction is titled with its description: **PASS, re-run live (2026-09-29).** Seeded a category-only-update queue item (`payload: { category_id }`, `label: 'Grocery run'`) directly into `ledger_offline_queue` (matching the exact shape `bulkUpdateCategory` now enqueues) against a real local Supabase transaction, opened the Queue review sheet: rendered as "Grocery run".
- (b) An update to a deleted row keeps the name it was queued with: **PASS, re-run live (2026-09-29).** Seeded a delete queue item (`payload: {}`, `label: 'Grocery run'`) the same way: rendered as "Grocery run", not the table name.
- (c) No item shows a raw table name: **PASS, re-run live (2026-09-29).** Seeded a third item on an unrecognised table (`weird_table`, no `label`): rendered as "Weird table" (via `humanizeTable`'s generic fallback), never the raw `weird_table` string.
- (d) Unit test on the title helper: **PASS.** `tests/queueItemTitle.test.mjs` (re-confirmed 2026-09-29).
- Checked `knowledge/patterns/offline-queue-conflict-handling.md`: this only changes how a title is *chosen for display*, not conflict resolution or drain behaviour, so it doesn't touch that pattern.
- Lint, build, full test suite (756 + redesign checks): PASS (re-confirmed 2026-09-29).

## Backlog
- `useMonthCycle.ts`'s `profiles` update was left without a `label` (it has no natural "name" — a pay-cycle-day change) and will show `humanizeTable('profiles')` → "Profile". Not reported broken by this ticket; flagging in case a future ticket wants a more specific note like "Pay cycle" instead.
