# Claude Code cloud sessions only

> **Scope:** these notes apply only to Claude Code on the web (the claude.ai cloud
> container, where `CLAUDE_CODE_REMOTE=true`). They are loaded into context by a
> SessionStart hook in `.claude/settings.json` that does nothing elsewhere.
> **If you are running locally, ignore this file** and follow `README.md` and
> `AGENTS.md`.

The cloud container starts fresh each session: nothing below is running yet.

## pnpm

The default `pnpm` shim is broken in the container: corepack's cached pnpm 12
crashes with `Cannot find module .../pnpm.cjs`. Use pnpm 10 through corepack
for every command:

```bash
corepack pnpm@10 install --frozen-lockfile
corepack pnpm@10 lint
corepack pnpm@10 build
corepack pnpm@10 test
```

## Local Supabase

The environment already points `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
at the local stack (`http://127.0.0.1:54321`). Docker is installed but its
daemon is not running at session start:

```bash
dockerd > /tmp/dockerd.log 2>&1 &          # wait until `docker info` succeeds
supabase start -x studio,imgproxy,vector,logflare,edge-runtime,postgres-meta,supavisor
corepack pnpm@10 db:reset                  # migrations + supabase/seed.sql
```

The first `supabase start` pulls images and takes a few minutes; run it in the
background. Excluding the services above is optional and only speeds it up.

Seeded login (dev-only form on `/login`): `demo@ledger.local` / `ledger-demo-123`.

## Dev server and browser checks

```bash
corepack pnpm@10 dev --port 5173 --strictPort --host 127.0.0.1
```

If the port is taken, an earlier Vite process is still running; stop it rather
than starting a second server.

Playwright is installed globally (`require("$(npm root -g)/playwright")`) with
Chromium in `/opt/pw-browsers`; do not run `playwright install`. Launch with
`{ channel: 'chromium' }`.

- **Google Fonts fail** (`ERR_CERT_AUTHORITY_INVALID`): Chromium does not trust
  the egress proxy's CA, while Node does (`NODE_EXTRA_CA_CERTS`). Route only the
  font hosts through Node instead of disabling TLS checks:
  ```js
  await context.route(/fonts\.(googleapis|gstatic)\.com/, async (route) => {
    try { await route.fulfill({ response: await context.request.fetch(route.request()) }) }
    catch { await route.abort() }
  })
  ```
- **Do not** pass Playwright's `proxy` option or `--proxy-bypass-list=<-loopback>`:
  both send `127.0.0.1` through the proxy, and every local request returns 405.
- **Setup lock:** a fresh browser shows the first-run checklist and locks the
  Activity, Budgets, Categories and Reports tabs until the pay cycle is confirmed.
  Set `localStorage['ledger-first-run']` to `{"cycleConfirmed":true}` to skip it,
  or open pages by URL (they load regardless).

## Files for the user

The user follows the session in the Claude app and can only open files inside
the repository or the session scratchpad. Keep screenshots and scratch scripts in
the scratchpad, not the repo.
