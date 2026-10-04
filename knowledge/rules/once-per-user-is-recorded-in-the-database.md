# Something that must happen once per user is recorded in the database
A write that must happen once for the user (post a recurring row, record a payment, run a migration step for their data) checks and records "done" in the database, in the same statement as the write. `localStorage` may hold a shortcut, never the record.

**Why:** the recurring generator remembered what it had posted only in `localStorage`. Every other browser, device, private window or cleared storage posted each due row again, the copies posted their own next dates, and older rows re-posted past months (LED-232). One-context browser sweeps never showed it.

**How:**
- Keep the record on the row the work comes from (`transactions.recurrence_next_posted`), or a unique key that a second write would hit.
- Check and set it in one SECURITY INVOKER function that locks the row first (`patterns/atomic-write-as-an-invoker-function.md`), so two devices racing each other get one write. Return null for "already done", not an error.
- Never clear the record when the result is deleted: a deleted occurrence must not come back.
- A backfill for existing rows marks only what the data shows was done. Group carefully: two series can share a name (payroll on the 15th and on the last day).
- If the date is computed in JavaScript, pass it in; `setMonth` overflows (Jan 31 + 1 month = Mar 3) where Postgres clamps (Feb 28). To match it in SQL: `(date_trunc('month', d) + interval '1 month')::date + (extract(day from d)::int - 1)`.
- Check it with two browser contexts opened in parallel and count the rows in psql.
