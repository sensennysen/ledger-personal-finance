# A write that must not half-succeed is one SECURITY INVOKER function
When one user action needs several rows to change together (split a transaction, itemise loan debt), do it in one plpgsql function called with `supabase.rpc`, not in client requests.

**Why:** the client split wrote each line and then deleted the original as separate requests. A failure part-way left partial lines, or both the lines and the original (LED-130). A function is one statement, so Postgres rolls it back whole. `SECURITY INVOKER` keeps row level security in force, so it never bypasses the policy (AGENTS.md) and a user cannot touch another user's rows.

**How:**
- `create or replace function … security invoker set search_path = public`, then `revoke all … from public; grant execute … to authenticated`.
- Lock the parent row (`select … for update`) before computing anything the write depends on, and compute those figures in the function, not in the client. A stale client cannot then act on a gap or total that has already changed (LED-131).
- Take the owner from the locked row, never from the payload.
- Validate in the function and `raise exception` with a sentence a person can read; the client shows it with `toResult`.
- Existing triggers still fire per row inside the function. Reason about them: a split's inserts and delete net to zero on the balance, and the purchase insert raises owed by what is left to pay, so the function takes the old gap back off.
- Client: refuse offline before calling (an rpc is not queueable), make one call, refetch after, and report a failure on the notification surface with Retry that reruns the same call with the same arguments.

**Check it in psql** (`begin; … rollback;`), as an authenticated user:
```sql
select set_config('request.jwt.claims', json_build_object('sub', '<user uuid>', 'role', 'authenticated')::text, true);
set local role authenticated;   -- so RLS applies; use `set local role postgres` to seed rows
```
- Seed with the role `postgres`, call as `authenticated`, and read balances back as `postgres`.
- Run the failing cases under `savepoint` / `rollback to savepoint` in one script with `\set ON_ERROR_STOP off`.
- Cover: the happy path, a failure after the first child is written (an unknown category), a sum mismatch, the wrong account type, and a second user (expect "not found").
- Then run `supabase db lint --local --level warning --fail-on error`; it flags type mismatches in a variable initialiser (`'{}'` for a `uuid[]`).
- Put the observed figures in the unit test as literals (`patterns/mirror-a-sql-function-with-observed-fixtures.md`).
