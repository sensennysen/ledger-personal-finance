# pnpm switch + local DB scripts

## Pattern
pnpm 12 reads settings (`overrides`, `allowBuilds`) from `pnpm-workspace.yaml`, not the `pnpm` field in `package.json`. Local DB scripts hard-code `--local`; the only remote-touching script is `db:push:remote`, never chained.

## Backlog
- `pnpm dev:all`, `pnpm db:new` not run (dev:all is long-running; db:new creates a file).
- The repo is linked to a hosted Supabase project (`supabase status`), so `pnpm db:push:remote` would target it. Never run unprompted.
- `.npmrc` `legacy-peer-deps` is ignored by pnpm; remove when convenient.
- `core-js` build script set to `false` in `pnpm-workspace.yaml`; revisit if a tool needs it.
- CI change (`pnpm/action-setup@v4`, `packageManager` pin) unverified until the workflow runs on GitHub.
- `supabase/seed.sql` is empty; add local sample data if wanted.
- Local Supabase stack left running after validation (`pnpm db:stop`).
