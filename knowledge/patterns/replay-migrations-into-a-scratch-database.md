# Replay every migration into a scratch database before pushing

CI's `db` job runs `supabase db reset` (every migration, then `seed.sql`, on an empty database), but only on a pull request or `main`. `supabase migration up` locally applies only the new files to a database that already has data, so it cannot show that the chain still works from empty.

**Why:** in epic 24 phase 4 the replay showed that `seed.sql` had failed since LED-296. The seed inserted card payments that the new insert trigger had already recorded. Nothing local had caught it, because the seed never re-ran.

**How** (keeps the local data; uses the running local stack):
```bash
B=postgresql://postgres:postgres@127.0.0.1:54322/postgres; R=postgresql://postgres:postgres@127.0.0.1:54322/p4_replay
psql $B -c "create database p4_replay"
psql $R -c "create schema extensions; create extension pgcrypto with schema extensions; create extension \"uuid-ossp\" with schema extensions;"
docker exec supabase_db_ledger-personal-finance pg_dump -U postgres -s -n auth -n storage postgres > scratch/auth.sql
psql $R -q -f scratch/auth.sql >/dev/null 2>&1   # role/grant errors here are expected
for f in supabase/migrations/*.sql; do psql $R -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null || { echo "FAIL $f"; break; }; done
psql $R -v ON_ERROR_STOP=1 -f supabase/seed.sql
psql $B -c "drop database p4_replay"
```
- The baseline needs both `auth` and `storage` (it creates a bucket). A host `pg_dump` may not exist or may not match the server's version, so run it inside the container.
- Run the seed once. A `||` retry re-runs it and reports a duplicate key that is not the real error.
- To run role-based tests on the scratch database (`patterns/database-tests-with-pgtap.md`), add Supabase's default grants first. They come from the platform, not the migrations, so without them every `authenticated` statement fails with "permission denied for table": `grant usage on schema public, extensions to anon, authenticated, service_role; grant all on all tables in schema public to anon, authenticated, service_role; grant all on all sequences in schema public to anon, authenticated, service_role; grant execute on all functions in schema public to anon, authenticated, service_role;`
- To replay only the migrations before a fix (proving a test fails without it), apply only the files whose name sorts before the fix's timestamp: `[[ "$(basename $f)" < "20261007100000" ]] || continue`.
