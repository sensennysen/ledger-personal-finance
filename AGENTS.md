# AGENTS.md

Ledger: a self-hostable personal finance app. React 19 + TypeScript + Vite + Supabase + Tailwind. Deployed on Vercel.

## Commands
- `npm ci` — install (npm + `package-lock.json` only; `.npmrc` sets `legacy-peer-deps`). Do not commit pnpm files.
- `npm run dev` — local server.
- `npm run lint` — ESLint.
- `npm run build` — `tsc -b` then `vite build`.
- `npm test` — all `tests/*.test.mjs` via `node --test`, then `tests/redesign.mjs`.

CI (`.github/workflows/ci.yml`) runs lint, build and test on every PR and on push to `main`. Keep all three green.

## Layout
- `src/lib/` — pure logic and helpers. New logic that needs tests goes here.
- `src/components/`, `src/pages/`, `src/hooks/`, `src/contexts/`, `src/types/`.
- `supabase/migrations/` — the only way schema changes ship. `schema.sql` is the base.
- `docs/dev-tasks/` — ticket CSVs (LED-NN). `knowledge/` — rules, patterns, prompts, retros.
- `design_handoff_ledger_ui_audit/` — design source of truth.

## Standards
- Testable logic must import only relative/pure modules: `node --test` cannot resolve the `@/` alias or load Supabase. Keep logic in `src/lib` files such as `queueState.ts`, `accountSchema.ts`, `loadState.ts`.
- Every list view resolves state through `resolveLoadState`; a failed read is never rendered as an empty state.
- Auth and sync failures are surfaced to the user, not swallowed.
- One schema and one form per entity (see `AccountForm` + `accountSchema`).
- Access data through Supabase with RLS; never bypass it client-side.
- Match surrounding code style; no unrelated refactors.

## Workflow (E→P→A→V)
1. `/evaluate` — orient, check graphify (`graphify-out/`), and grep the design handoff for the ticket's screen.
2. `/plan` — blueprint, no code.
3. `/apply` — implement exactly the plan; one commit per LED-NN ticket.
4. `/validate` — lint, build and test must pass; write a retro in `knowledge/retros/` with a Backlog of anything not verified.

See `knowledge/README.md` for the rules and patterns index.
