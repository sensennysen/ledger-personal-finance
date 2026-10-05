# Ledger

[![CI](https://github.com/sensennysen/ledger-personal-finance/actions/workflows/ci.yml/badge.svg)](https://github.com/sensennysen/ledger-personal-finance/actions/workflows/ci.yml)

I made this because I hate being paywalled.

Personal finance tools love to start friendly, then quietly slide the useful bits behind a subscription screen: budgets, reports, exports, custom categories, account history, the very basic dignity of seeing where your money went. Ledger is my answer to that. It is a self-hostable personal wallet app for tracking accounts, spending, budgets, credit cards, and reports without asking a monthly toll to remember your own groceries.

## What It Does

- Tracks cash, checking, savings, digital wallets, credit cards, loans, investments, and other accounts.
- Records income, expenses, transfers, fees, notes, tags, receipts, and recurring transactions.
- Organizes spending with custom categories and subcategories.
- Monitors budgets with rollover support and month-cycle preferences.
- Handles credit card balances, limits, statement dates, due dates, reminders, payments, and utilization targets.
- Shows dashboard widgets for balances, cash flow, category breakdowns, budgets, upcoming bills, recent transactions, forecasts, and card health.
- Exports and reports on account balances and transaction history.
- Supports Supabase authentication, row-level security, data deletion, and user-owned records.
- Works as a Vite React app with PWA and offline-friendly pieces.

## Tech Stack

- React 19
- TypeScript
- Vite
- Supabase
- Tailwind CSS
- shadcn-style UI primitives
- Recharts
- React Hook Form and Zod

## Getting Started

Install dependencies:

```bash
pnpm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Fill in your Supabase project values:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
# Optional: the public address, for the canonical link, sitemap.xml and robots.txt
VITE_SITE_URL=https://ledger.example.com
```

On a hosting provider, set the same variables there (on Vercel: Project → Settings → Environment Variables). Without `VITE_SITE_URL` the build ships no canonical link and no sitemap.

**New database.** Apply every file in `supabase/migrations/` in filename order, for example with `supabase link` then `supabase db push`, or by running each file in the SQL editor. The first file is the baseline schema; `supabase/schema.sql` is the same baseline and has none of the later migrations, so running it alone leaves a database every save fails against.

**Upgrading a self-hosted database.** Apply every file in `supabase/migrations/` that your database does not have yet, in filename order, *before* you deploy the new client. Each file is idempotent. A database missing a column the client writes rejects every transaction save, not only the new feature's. `knowledge/checklists/release.md` lists each migration and what fails without it.

Start the app:

```bash
pnpm dev
```

Build for production:

```bash
pnpm build
```

Preview the production build:

```bash
pnpm preview
```

## Local development

This project uses **pnpm** (not npm). Prerequisites: [pnpm](https://pnpm.io), [Docker](https://docs.docker.com/get-docker/) and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).

Start the local database and the app together:

```bash
pnpm dev:all
```

Run `pnpm db:status` for the local API URL and anon key, then put them in `.env.local` (see the commented block in `.env.example`). The local stack uses the ports set in `supabase/config.toml` (API 54321, DB 54322, Studio 54323).

| Command | What it does |
| --- | --- |
| `pnpm dev:all` | Starts the local Supabase stack, then the Vite dev server |
| `pnpm db:start` / `pnpm db:stop` | Start / stop the local Supabase stack |
| `pnpm db:status` | Show local URLs and keys |
| `pnpm db:reset` | Wipe the **local** database, replay all migrations, then run `supabase/seed.sql` |
| `pnpm db:migrate` | Apply pending migrations to the local database, keeping data |
| `pnpm db:new <name>` | Create a new timestamped migration in `supabase/migrations/` |
| `pnpm db:diff` | Show schema changes in the local database not yet in a migration |
| `pnpm db:push:remote` | Push migrations to the **linked remote** project. Prod-facing, never run by another script |

`supabase/seed.sql` creates a demo user with accounts, about three months of transactions, budgets, savings goals, a financed car loan and categorization rules. Dates are relative to today, so the data stays current after each `pnpm db:reset`. In dev builds the login page shows an email/password form prefilled with the demo credentials (it is not included in production builds):

- Email: `demo@ledger.local`
- Password: `ledger-demo-123`

The first-run checklist's pay-cycle step is stored in the browser, not the database, so a fresh browser still shows it and keeps the Activity, Budgets, Categories and Reports tabs locked until you confirm the cycle on the dashboard. Automated tests can skip it by setting `localStorage['ledger-first-run']` to `{"cycleConfirmed":true}` before loading the app.

Schema changes ship only as timestamped, idempotent files in `supabase/migrations/`; do not edit prod by hand. All `db:*` commands except `db:push:remote` target the local stack only.

## Project Structure

```text
src/
  components/   reusable UI, layout, dashboard, and transaction pieces
  contexts/     auth and theme providers
  hooks/        data and behavior hooks for finance workflows
  lib/          Supabase, cache, offline, credit card, and receipt helpers
  pages/        route-level app screens
  types/        shared TypeScript models
supabase/
  schema.sql    baseline schema only (same as the first migration)
  migrations/   incremental database changes
```

## Scripts

- `pnpm dev` starts the local Vite server.
- `pnpm dev:all` starts local Supabase, then the Vite server.
- `pnpm build` type-checks and builds the app.
- `pnpm lint` runs ESLint.
- `pnpm test` runs the node test suite.
- `pnpm preview` serves the built app locally.
- `pnpm db:*` manage the local database (see [Local development](#local-development)).
- `pnpm sweep` runs the dev-only live sweep (see [Sweep script](#sweep-script)). CI does not run it.

### Sweep script

`scripts/sweep.mjs` signs in to a running local copy as the seeded demo user and, for each route, width and theme, scans the rendered page for text contrast (4.5:1, 3:1 for large text), lists light panels in the dark theme, checks for sideways scrolling and saves a full-page screenshot. It prints one PASS/FAIL line per check and writes `sweep-out/results.json` (git-ignored). It only talks to `--base-url`, never the linked remote.

Prerequisites: the local stack and seed (`pnpm db:start`, `pnpm db:reset`), the dev server (`pnpm dev`, which has the dev sign-in form), and Playwright with Chromium installed locally or globally (`npm i -g playwright && npx playwright install chromium`). Playwright is not a dependency of this repo.

```bash
pnpm sweep                                    # app and legal routes, 390 and 1280, light and dark
pnpm sweep --routes /,/reports --widths 390 --themes dark
pnpm sweep --home-fold                        # also: which Home widgets sit above the fold at 390x844
pnpm sweep --hover                            # also: hover each hover:bg-* element and scan its text
```

Other flags: `--base-url` (default `http://127.0.0.1:5173`), `--out` (default `sweep-out`), `--email` and `--password` (default the demo user), `--relay-fonts` (fetch Google Fonts through Node, for containers whose proxy Chromium does not trust). The exit code is 1 when any check fails. What it does not see: SVG text such as chart labels, and focus rings (`knowledge/patterns/rendered-contrast-scan.md`).

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs lint, build and tests on every pull request and on pushes to `main`. A separate `db` job starts a fresh local Supabase, applies all migrations and the seed, lints database functions and replays the migrations from scratch, so a migration that fails on an empty database fails CI. CI cannot see the hosted database or the headers Vercel serves; `knowledge/checklists/release.md` covers those before a release. Contributor conventions are in `AGENTS.md`.

## Philosophy

This is not trying to be a bank, a brokerage, or a glossy budget coach that sends you emails with a stock photo of a latte. It is a ledger: your accounts, your rules, your data, your ability to leave.

The point is simple: the features people need to understand their money should not be premium add-ons.
