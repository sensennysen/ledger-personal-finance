# LED-133 · Server-side monthly interest rate cap — retro (2026-09-25)

The 10% monthly cap lived only in the client (`MAX_MONTHLY_INTEREST_PCT`); the database checked only `monthly_interest_rate >= 0`, so a request that bypassed the form could store a rate that yields a 31x installment.

## What shipped
- `supabase/migrations/20260925100000_cap_monthly_interest_rate.sql`: a named check, `loan_purchases_monthly_interest_rate_max`, `monthly_interest_rate <= 10`, added `NOT VALID` after a `drop constraint if exists`, so re-running is a no-op. Existing rows above 10 are neither rejected nor rewritten.
- `tests/loanRateSql.test.mjs`: reads the migrations, checks the constraint is a named `NOT VALID` check with no `validate constraint`, and fails if the SQL limit differs from `MAX_MONTHLY_INTEREST_PCT`.
- The table is `loan_purchases`; the ticket named the two migration files that define it.
- `schema.sql` is unchanged, per the schema-changes rule (the base did not change).

## Acceptance criteria
- (a) New migration adds the constraint as NOT VALID: PASS. `pg_constraint` shows `convalidated = f`.
- (b) A rate above 10 inserted directly in SQL is rejected: PASS on the local database (10.0001 rejected, 10 accepted), in a rolled-back transaction.
- (c) Existing rows above 10 untouched: PASS. A row at 15 stayed at 15 after the constraint was added.
- (d) Test fails if SQL and client limits disagree: PASS.
- (e) Applies cleanly to an empty database: NOT VERIFIED locally. I applied it to the running local database (`pnpm db:migrate`) and re-ran the file to confirm it is idempotent, but did not run `pnpm db:reset`, which would wipe local data. The CI `db` job replays every migration from scratch and is the check for this.
- (f) Lint, build and test pass: PASS (405/405).

## Backlog
- CI `db` job result for the new migration (criterion e) is only known after the PR runs.
- A NOT VALID check is enforced on every insert and update of a row, so a legacy row above 10 rejects any update, not just a rate change (an update setting only `notes` on a 15% row failed). That is the ticket's intended outcome (the edit form already shows the rate error until corrected), but any code path that updates such a row without editing the rate, for example a future bulk update, would fail on it. Nothing in `src` updates `loan_purchases` besides the purchase form.
- Whether any real rows exceed 10 was not checked (local data only). Run `select count(*) from loan_purchases where monthly_interest_rate > 10` on remote before relying on this, and validate the constraint once those rows are fixed.
