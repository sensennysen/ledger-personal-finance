# LED-130 · Split a transaction atomically — retro (2026-09-25)

## What shipped
- `supabase/migrations/20260925110000_split_transaction_rpc.sql`: `split_transaction(original_id uuid, lines jsonb) returns uuid[]`, `SECURITY INVOKER`, `search_path = public`, execute granted to `authenticated` only. It locks the original, validates the lines (at least two, amounts above zero, descriptions, sum equals the original to the cent), inserts every child, deletes the original and returns the new ids.
- Children carry `currency`, `exchange_rate`, `notes`, `date`, `tags`, `receipt_url`, `goal_id`, and the subcategory when the line keeps the original's category.
- `useTransactions.splitTransaction` makes one `rpc` call; offline it returns the refusal message without queueing. `handleSplitConfirm` became `runSplit`: a failure goes to the notification surface with **Retry**, which reruns the same call with the same lines.
- `splitState.ts`: `buildSplitRpcLines`, `SPLIT_OFFLINE_MESSAGE` (tested). The dialog no longer says the receipt and tags are lost.

## Decisions
- **Transfers and any transaction with `to_account_id` are refused** (loan repayments, card payments). The old client wrote children with `to_account_id: null`, which silently turned a repayment into a plain expense and cascade-deleted its loan allocations. The UI already hides Split for these in the row and menu; the function is the backstop.
- **Subcategory carries only where the category does**, because `trg_transactions_reference_ownership` ties a subcategory to its category.
- The dialog closes on failure. Retry holds the lines, so nothing typed is lost.
- Sharing one `receipt_url` across children is safe: nothing in `src` removes objects from the `receipts` bucket.

## Acceptance criteria
- (a) One rpc call, all or nothing: PASS. Live: the first attempt failed at the network, the original was untouched, Retry then wrote both lines and removed the original. In psql a bad category on line 2 (after line 1 was inserted) left the original and the balance unchanged.
- (b) Tags, receipt, subcategory and goal_id carry to every child: PASS. Live, both children kept `{weekly,home}`, the receipt path and the goal. In psql the subcategory carried to the same-category line only.
- (c) Balances unchanged by a split: PASS. Local database: 900.00 before and after; live account stayed 1900.00.
- (d) Failure shows the notification with Retry: PASS live.
- (e) Splitting offline is refused with a message: PASS live (no Retry offered, transaction unchanged).
- (f) Migration applies to an empty database and to seed.sql: PARTIAL. Applied twice on the local database (`create or replace`) and `supabase db lint --local` is clean. The from-scratch replay was left to CI, because `db reset` would wipe the local users.
- (g) Lint, build and test pass: PASS (541/541).

## Backlog
- The from-scratch replay (`pnpm db:reset`) was not run locally. CI's `db` job does it.
- `EntryDetail`'s Split action is offered for a loan repayment (only `transfer` is excluded at `TransactionRow.tsx:135`); the function refuses it, but the user sees a generic failure sentence with the raw message tucked away. Hide it there too.
- Children are written with `is_recurring = false`, as before. Splitting a recurring transaction ends its recurrence.
- Retry after the dialog closes has no in-app confirmation on success; the two rows just appear.
