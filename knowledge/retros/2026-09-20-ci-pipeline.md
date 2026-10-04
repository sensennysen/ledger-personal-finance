# CI pipeline, AGENTS.md and knowledge base

- `.github/workflows/ci.yml` runs `npm ci`, lint, build and `npm test` on PRs and pushes to `main`. `npm test` aggregates `tests/*.test.mjs` plus `tests/redesign.mjs`.
- Build and tests pass with no `.env` files, so the workflow sets no Supabase variables.

## Backlog
- The workflow has not run on GitHub yet; confirm the first run is green.
- Enable branch protection with `verify` as a required check.
- `pnpm-lock.yaml` and `pnpm-workspace.yaml` are untracked strays; delete or gitignore.
- `npm ci` prints audit warnings; nothing was triaged.
- Vite warns that `vite.config.ts` uses `__dirname` under the native config loader.
- No Supabase migration or schema check in CI.
