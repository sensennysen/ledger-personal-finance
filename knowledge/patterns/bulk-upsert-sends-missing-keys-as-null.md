# A bulk insert or upsert sends a missing key as null, not as the column default
When the rows in one `supabase.from(t).insert(rows)` or `.upsert(rows)` call do not all have the same keys, supabase-js sends `?columns=` with the union of the keys. PostgREST then writes **null** for any key a row leaves out, so a `not null default gen_random_uuid()` id fails with `23502` ("null value in column \"id\"").

**Why:** LED-257's one-time template upload kept each old template's id when it was a valid uuid and left `id` out otherwise. Unit tests of the row builder passed, but the first real upload failed with a 400 the moment one entry had an id and another did not. Only a browser run against local Supabase showed it.

**How:**
- Pass `defaultToNull: false` (PostgREST `Prefer: missing=default`) when rows may leave keys out, so each missing key takes its column default.
- Or build every row with the same keys.
- Test a bulk write with mixed rows against the local database, not only the pure function that builds them.
