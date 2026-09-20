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
```

Run the Supabase schema in `supabase/schema.sql`, then apply any migrations in `supabase/migrations` that match your deployment state.

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
  schema.sql    base database schema
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

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs lint, build and tests on every pull request and on pushes to `main`. Contributor conventions are in `AGENTS.md`.

## Philosophy

This is not trying to be a bank, a brokerage, or a glossy budget coach that sends you emails with a stock photo of a latte. It is a ledger: your accounts, your rules, your data, your ability to leave.

The point is simple: the features people need to understand their money should not be premium add-ons.
