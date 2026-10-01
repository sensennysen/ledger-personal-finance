# Ledger

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
npm install
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

### Local Supabase with seed data

For development and testing you can run Supabase locally instead (requires Docker and the Supabase CLI):

```bash
supabase start      # applies migrations and supabase/seed.sql on first start
supabase db reset   # re-applies migrations and reloads the seed at any time
```

Point `.env.local` at the local stack (`supabase status` prints the anon key):

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key from supabase status>
```

The seed creates a demo user with accounts, about three months of transactions, budgets, savings goals, a financed car loan, and categorization rules. Dates are relative to today, so the data stays current after each reset. In dev builds the login page shows an email/password form prefilled with the demo credentials:

- Email: `demo@ledger.local`
- Password: `ledger-demo-123`

The form is only rendered when `import.meta.env.DEV` is true, so it is not included in production builds.

Start the app:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

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

- `npm run dev` starts the local Vite server.
- `npm run build` type-checks and builds the app.
- `npm run lint` runs ESLint.
- `npm run preview` serves the built app locally.

## Philosophy

This is not trying to be a bank, a brokerage, or a glossy budget coach that sends you emails with a stock photo of a latte. It is a ledger: your accounts, your rules, your data, your ability to leave.

The point is simple: the features people need to understand their money should not be premium add-ons.
