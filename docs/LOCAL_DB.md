# Local database (Supabase stack + prod data)

A local mirror of the production Supabase project (`krpnjvqjdyybohhqsbxi`) for
offline development against real data.

## Daily use

```bash
supabase start        # boot local Postgres + Auth + PostgREST (Docker)
supabase stop         # shut down (data persists)
supabase db reset     # wipe + re-apply migrations + reload supabase/seed.sql
```

`.env.local` points at the local stack. Production values are saved in
`.env.local.prod` — swap that back in to run against prod.

| Service      | URL                              |
|--------------|----------------------------------|
| API (PostgREST / Auth) | http://127.0.0.1:54321  |
| Postgres     | postgresql://postgres:postgres@127.0.0.1:54322/postgres |
| Mailpit (test inbox)   | http://127.0.0.1:54324  |

`supabase status` prints the local anon / service-role keys.

## How it was built

1. `supabase init` created `supabase/config.toml`. Disabled locally to keep the
   stack lean and healthy: `analytics`, `realtime`, `studio`, `storage`,
   `edge_runtime`. Re-enable in `config.toml` if you need them (receipts use
   `storage`).
2. Production migration history was reconciled: the 13 pre-existing migrations
   were `supabase migration repair --status applied`, then the 2 newest
   (`20260910120000`, `20260910130000`) were `supabase db push`ed to prod.
3. The delta files in `supabase/migrations/` are patches on top of the old
   `supabase/schema.sql`, so they can't replay from an empty DB. A full schema
   snapshot pulled from prod (`supabase db dump --linked`) is the baseline
   migration `00000000000000_remote_schema.sql` (git-ignored — see
   `supabase/.gitignore`). `db reset` applies the baseline, replays the 15
   deltas idempotently, then loads the data.
4. `supabase/seed.sql` = `supabase db dump --linked --data-only --schema public`
   (git-ignored — real personal financial data).
5. `auth.users` / `auth.identities` were loaded separately from
   `supabase db dump --linked --data-only --schema auth`.

## Refreshing data from prod

```bash
supabase db dump --linked --data-only --schema public -f supabase/seed.sql
supabase db dump --linked --data-only --schema auth   -f /tmp/auth_data.sql
supabase db reset
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=0 -f /tmp/auth_data.sql
```

To also refresh the schema baseline: `supabase db dump --linked -f supabase/migrations/00000000000000_remote_schema.sql`.

## Auth / login (local Google OAuth)

All prod users are Google OAuth. `config.toml` has `[auth.external.google]`
enabled, reading credentials from the git-ignored root `.env`:

- `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`
- `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`

One-time Google Cloud setup (use the same OAuth 2.0 Client the prod project
uses, or make a new "Web application" client):

1. APIs & Services → Credentials → your OAuth client.
2. Under **Authorized redirect URIs** add:
   `http://127.0.0.1:54321/auth/v1/callback`
3. Copy the client ID + secret into root `.env`.
4. `supabase stop && supabase start` (config + `.env` are read at boot).

`site_url` / `additional_redirect_urls` are set to the Vite dev origin
`http://localhost:5173`. `skip_nonce_check = true` is required for local Google
sign-in.
