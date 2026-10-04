# LED-232 · Recurring rows post once, on any device — retro (2026-10-03)

Branch `claude/jolly-faraday-swv39i`, after the epic 20 validation (`acc60af`). One code commit, `e9ebcd5`.

## What shipped
- Migration `20261003110000_recurring_posts_once.sql`:
  - **The record:** a new column `transactions.recurrence_next_posted` (default false), true once the row's next occurrence is posted. It is never cleared, so deleting the posted row does not bring it back.
  - **The RPC:** `post_recurring_transaction(p_source, p_date)`, SECURITY INVOKER.
    - It locks the source row, then returns null when the row is not recurring, already posted, or past its end date.
    - It raises "not found" for a missing row or another user's row, and raises when the date is not after the source row's date.
    - Otherwise it sets the flag and inserts the copy in one statement.
  - **A partial index** covers the unposted recurring rows.
- **Backfill.** A legacy row is marked posted when its series shows the next occurrence. A series is the rows with the same account, destination, type and description. The row counts as posted when:
  - a row of the series is on its next date, or
  - a later recurring row of the series is on or after that date, or
  - it is a later duplicate of an identical row.
  - Duplicates stay for the user to review.
  - The next date mirrors JS `setMonth` overflow.
  - Only `set_updated_at` fires for the new column; it is paused for the backfill.
- **`generateDueRecurring`** reads only unposted rows and filters them through the new `dueRecurringPosts` (in `src/lib`). It calls the RPC for each due row and runs the card statement steps only for an id the RPC returned. The `localStorage` marker is now only a shortcut.
- **`AppLayout`** reports a failed post as "Recurring transactions not posted", with Retry.
- **Undo** carries the flag, so a restored row that had already posted does not post again.

**Changed from the plan.** The planned backfill was "only the latest row of a series may still post". Run against the seed, it closed the Sep 15 "Acme Corp payroll" row: payroll is two monthly series with one description, the 15th and the last day. The rule above replaced it before the commit, and the seed's payroll rows stay open.

## Before the fix
I reproduced the bug on the old code with two Playwright contexts opened in parallel, against a series shaped the way the app leaves it (Aug 1 and Sep 1, both recurring) and a recurring transfer into the Visa dated Sep 2. The result:
- Sep 1 ×3: the Aug 1 row re-posted a past month in each context. This is wider than the ticket, which saw only today's copies.
- Oct 1 ×2.
- The card transfer on Oct 2 ×2, with 2 payment rows.

The seed already worked around this: it flags only the latest occurrence of each series as recurring.

## Checks
- `pnpm lint`, `pnpm build` and `pnpm test` pass (834 tests). New: `tests/recurringPosts.test.mjs` (7 tests) and 2 tests in `undoRestore.test.mjs`.
- `db:reset` replays every migration and the seed onto an empty database.
- `supabase db lint --local --level warning --fail-on error` finds nothing.

| Criterion | Result | Evidence |
|---|---|---|
| (a) two browsers on a due day post once | PASS | Two contexts opened in parallel: one row for Oct 1 (series) and one for Oct 2 (card transfer). A psql race between two sessions calling the RPC on one row also gave one id and one null, with one row inserted. |
| (b) a private window or cleared storage posts nothing already posted | PASS | A third fresh context, with no marker, posted nothing; all counts unchanged. psql: once the copy is deleted, a second call still returns null. |
| (c) a recurring card transfer gives one payment and one statement step | PASS | One linked `credit_card_payments` row. Visa statement paid 0 → 50.00 (statement 500) and balance -1238.69 → -1188.69, once. |
| (d) migration applies to an empty database; duplicates are kept | PASS | `db:reset`. Applied to a database holding the reproduced duplicates: every row kept. The later duplicates and the older rows are marked; payroll, Gym and the other single series stay open. Account balances, card payments and `updated_at` are byte-identical before and after. |
| (e) re-run the epic 20 retro's two-context check | PASS | The (a) run |
| New: a failed post is reported | PASS | RPC blocked: "Recurring transactions not posted. 1 recurring transaction is due but could not be posted." with Retry. Unblocked and Retry clicked: the row posts once and the notice closes. `shots/232-retry-notice.png` |
| New: the SQL next date matches JS | PASS | 27 cases (monthly, quarterly and yearly on the 29th to 31st, Feb 29, Dec 31): identical, for example Jan 31 → Mar 3 and Feb 29 2028 → Mar 1 2029. |

## Backlog
- **Deploy order.** The client filters on `recurrence_next_posted`. If the frontend ships before the migration reaches the remote database, the read fails and the generator posts nothing, silently, as any failed read does. The migration must go first (`db:push:remote`, only when asked). Not verified against the remote.
- **Splitting a recurring row.** `split_transaction` gives each line `is_recurring` with the flag false. Splitting a row that already posted its next occurrence makes each line post its own next date. This is unchanged from before, and the RPC is untouched.
- **Backfill grouping is by description.** An older row renamed apart from its series is unmatched and can post one back-dated row the first time any device runs the generator. A series that missed its own post while another series under the same description posted later could be marked wrongly. Both are rare.
- **`updated_at` bumps.** The RPC's flag update changes the source row's `updated_at`. A queued offline edit of that same row then reports a conflict when it drains. Not verified in the browser.
- **One step per load.** A series several intervals behind still catches up one occurrence per app load, as before.
- **A failed read of recurring rows is still silent.** It returns `{ posted: 0, failed: 0 }`, as before. The list pages report their own read failures.
- **Duplicates already in user data** are kept but not flagged in the UI. A "possible duplicates" review is not part of this ticket.

## Notes for next time
- New rule `rules/once-per-user-is-recorded-in-the-database.md`. Pattern `browser-check-with-local-user.md` item 28 now says how to make a recurring row due, or stop one posting, with the flag.
- Run a backfill rule against the seed before trusting it. The "latest row per group" rule read well and was wrong for the seed's payroll.
