# Database behaviour tests: pgTAP files plus a two-session script

Since LED-319, CI's `db` job runs `supabase test db` (every `supabase/tests/database/*.test.sql`) and `bash supabase/tests/concurrency.sh` after the replay. Locally: `pnpm db:test`. A migration that changes access or money rules adds its checks here, not only to its retro.

**Why:** the hand-run SQL checks in the epic 24 retros proved each fix once. Nothing stopped a later migration from undoing them.

**How:**
- One file per concern, each `begin; create extension if not exists pgtap with schema extensions; select plan(n); … select * from finish(); rollback;`. Insert users straight into `auth.users`, the way `seed.sql` does; `handle_new_user()` makes the profile.
- Switch identity with `set local role authenticated` and `set_config('request.jwt.claims', '{"sub":…,"role":"authenticated"}', true)`. For anon, set the claims to `{"role":"anon"}` too, or `auth.uid()` stays the last user. pgTAP's assertions work as either role.
- Count "can see nothing" over every user-owned table with a `pg_temp` function that loops over `pg_catalog` (`user_id` columns in `public`). A new table is then covered without editing the test. Use `pg_catalog`, not `information_schema`, which hides tables the role has no grant on.
- Deferred constraint triggers (LED-315) only fire at commit. `set constraints all immediate` before the statement makes them fire at its end. `set constraints all deferred` → statements → `select lives_ok('set constraints all immediate', …)` checks a sequence that is only consistent at the end.
- **Never call a function the role may not EXECUTE.** Local Postgres 17.6.1.111 segfaults instead of raising (epic 24 phase 1 retro).
- Keep a defect's checks in their own file. On a database without the fix, the first missing function aborts the rest of the file, so one file per defect shows each failure separately.
- Concurrency needs two connections, which pgTAP can't open. `concurrency.sh` starts one `psql` session that holds its transaction (`pg_sleep(2)`), starts the second in the background, and checks committed rows of a throwaway user. It deletes the user on `trap EXIT`, which cascades.
- Prove a test catches the defect: replay the migrations before the fix into a scratch database (`replay-migrations-into-a-scratch-database.md`, including the grants step), run the files with `psql -f` and `DB_URL=… bash supabase/tests/concurrency.sh`, and record the `not ok` lines in the retro.
