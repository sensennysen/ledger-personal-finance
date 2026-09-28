# LED-160 · Queue review sheet titles items by table name — retro (2026-09-28)

## What shipped
- Root cause was narrower than "no description": a normal transaction edit already submits the whole form (including `description`), so `itemTitle()`'s `payload.description` fallback already worked for that path. The raw `"transactions"` title only showed for a **delete** (`payload: {}`) or a **category-only update** (`payload: { category_id }`) — neither carries a name.
- Added a display-only `label?: string` to `QueueItem` (`queueState.ts`) — never read by `queueDrain.ts` (checked: it only ever passes `.payload` to Supabase's `insert`/`update`), so it can't leak into a write.
- `useTransactions.ts`'s `updateTransaction`, `deleteTransaction`, `bulkDeleteTransactions` and `bulkUpdateCategory` now pass `label: existing.description` (or `tx.description`) from the transaction already in memory at enqueue time.
- Moved `itemTitle`/`itemNote` out of `QueueReviewSheet.tsx` into a new pure `src/lib/queueItemTitle.ts` (AGENTS.md: testable logic lives in `src/lib`), and gave the table-name fallback a `humanizeTable()` map (`transactions` → `Transaction`, `profiles` → `Profile`) with a generic strip-trailing-s + capitalize fallback for anything else, so an unrecognised table is still never shown raw.
- `tests/queueItemTitle.test.mjs` (7 tests): partial-update-falls-back-to-label, delete-keeps-the-name, payload wins when present, unlabelled+no-name falls back to the humanized name (not raw), an unknown table is still singularized/capitalized, a conflict falls back to `serverSnapshot`, and `itemNote` doesn't show a raw table name either.

## Acceptance
- (a) An edited transaction is titled with its description: **PASS** — works via `payload.description` for a normal edit, and now via `label` for a category-only edit too.
- (b) An update to a deleted row keeps the name it was queued with: **PASS.** Traced `queueDrain.ts`'s conflict path (`{ ...current, status: 'conflict', conflictKind: 'deleted' }`) — it spreads the whole item, so `label` survives a delete-conflict untouched.
- (c) No item shows a raw table name: **PASS**, tested (`humanizeTable`).
- (d) Unit test on the title helper: **PASS.** `tests/queueItemTitle.test.mjs`.
- Checked `knowledge/patterns/offline-queue-conflict-handling.md`: this only changes how a title is *chosen for display*, not conflict resolution or drain behaviour, so it doesn't touch that pattern.
- Lint, build, full test suite (756 + redesign checks): PASS.

## Backlog
- Not re-run live against an actual queued delete/category-edit in a browser (no extension connected this session) — verified by code and unit test only, same call the LED-54/LED-52 retros made for their own not-yet-existing test data.
- `useMonthCycle.ts`'s `profiles` update was left without a `label` (it has no natural "name" — a pay-cycle-day change) and will show `humanizeTable('profiles')` → "Profile". Not reported broken by this ticket; flagging in case a future ticket wants a more specific note like "Pay cycle" instead.
