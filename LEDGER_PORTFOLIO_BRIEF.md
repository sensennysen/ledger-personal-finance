# Project Metadata

- **Name:** Ledger
- **Repo:** `https://github.com/sensennysen/personal_wallet_app` (`git remote -v`)
- **Live demo:** Unknown; `vercel.json` exists, but no public URL is documented in the repo
- **Validation checked:** `npm run lint` and `npm run build` both passed locally on June 16, 2026

## 1. One-Line Summary

Ledger is a self-hostable personal finance web app that helps individuals track accounts, transactions, budgets, credit cards, and reports without subscription-style feature gating (`README.md`, `src/App.tsx`, `src/pages/*`).

## 2. Problem

The README frames the project as a response to paywalled personal finance tools that lock core capabilities like budgets, reports, exports, and account history behind subscriptions (`README.md:3-17`).
From the shipped screens and schema, the app solves day-to-day money tracking for people who want:

- multi-account balance tracking
- categorized income/expense logging
- budget monitoring with rollover
- credit card due-date and utilization visibility
- exportable reports
- ownership over their own hosted data

## 3. My Role

Based on repository breadth, Bille appears to have owned or strongly influenced:

- frontend product UX in React/Vite across dashboard, accounts, transactions, categories, budgets, reports, settings, and legal pages (`src/pages/*`, `src/components/*`)
- client-side data layer and state hooks for accounts, transactions, budgets, goals, rules, receipts, offline sync, and preferences (`src/hooks/*`, `src/lib/*`)
- database design and security policy work in Supabase schema/migrations (`supabase/schema.sql`, `supabase/migrations/*`)
- authentication and account lifecycle flows, including Google OAuth sign-in and self-service account deletion (`src/contexts/AuthContext.tsx`, `src/pages/LoginPage.tsx`, `src/pages/SettingsPage.tsx`)
- deployment and browser security configuration for Vercel/PWA (`vercel.json`, `vite.config.ts`, `public/manifest.json`)

## 4. Core Features

- Multi-account tracking for cash, wallets, checking, savings, credit cards, loans, investments, and other account types (`README.md:9`, `src/pages/AccountsPage.tsx`, `supabase/schema.sql:101-124`)
- Transaction management with income, expense, and transfer flows, plus tags, receipts, recurring transactions, goal links, split transactions, bulk recategorization, CSV import, and undo delete (`src/pages/TransactionsPage.tsx`, `src/components/transactions/TransactionForm.tsx`, `supabase/schema.sql:156-199, 405-582`)
- Category management with custom categories, subcategories, ordering, and rule-management UI for auto-categorization (`src/pages/CategoriesPage.tsx`, `src/hooks/useSubcategories.ts`, `src/hooks/useTransactionRules.ts`)
- Budget tracking with monthly/weekly/quarterly/yearly periods, rollover logic, history, and drill-down into covered transactions (`src/pages/BudgetsPage.tsx`, `src/hooks/useBudgets.ts`, `supabase/schema.sql:215-234, 514`)
- Savings goals with contribution tracking and transaction linkage (`src/pages/BudgetsPage.tsx`, `src/hooks/useSavingsGoals.ts`, `supabase/schema.sql:519-582`)
- Dashboard widgets for balances, cash flow, category mix, budgets, recent activity, upcoming bills, forecast, and credit card health, including widget reordering/preferences (`src/pages/DashboardPage.tsx`, `src/hooks/useDashboardData.ts`, `src/hooks/useDashboardPrefs.ts`)
- Reporting with CSV export, PDF export, saved presets, net-worth trend, monthly income-vs-expense views, merchant breakdowns, and an embedded “Thirteenth Month” view (`src/pages/ReportsPage.tsx`)

## 5. Technical Stack

- Frontend: React 19, TypeScript, Vite, React Router (`package.json:27-32, 53`)
- Styling/UI: Tailwind CSS 4, shadcn-style primitives, lucide-react (`package.json:19-21, 25, 33, 41, 50`)
- Forms/validation: React Hook Form + Zod (`package.json:14, 30, 37`)
- Charts/reporting: Recharts, jsPDF, jspdf-autotable (`package.json:24, 25, 33`)
- Backend/data platform: Supabase JS + Supabase Auth + Supabase Storage (`package.json:16-18`, `src/lib/supabase.ts`)
- Database: PostgreSQL via Supabase schema and SQL migrations (`supabase/schema.sql`, `supabase/migrations/*`)
- Deployment/PWA: Vercel config + `vite-plugin-pwa` (`vercel.json`, `vite.config.ts`, `package.json:54`)
- Tooling: ESLint, TypeScript (`package.json:40-53`)

## 6. Architecture Notes

- **Frontend:** SPA built in React with route-level pages under `src/pages` and reusable UI/domain components under `src/components`.
- **Backend/API layer:** No custom app-owned API server was found. The client talks directly to Supabase from hooks like `useAccounts`, `useTransactions`, `useBudgets`, and `useSavingsGoals` (`src/hooks/*.ts`, `src/lib/supabase.ts`).
- **Database:** Supabase/Postgres schema defines profiles, accounts, categories, subcategories, transactions, budgets, credit card payments, savings goals, and transaction rules (`supabase/schema.sql`).
- **Auth/session handling:** Google OAuth via Supabase Auth; session loaded with `getSession()` and watched with `onAuthStateChange()` (`src/contexts/AuthContext.tsx:54-80`, `src/pages/LoginPage.tsx:114-145`).
- **Deployment:** Vercel SPA rewrite plus response security headers (`vercel.json`).
- **Important integrations:** Supabase Auth, Postgres, Storage; browser Notification API for reminders; PWA install/offline support (`src/pages/SettingsPage.tsx:142-161, 408-446`, `vite.config.ts`, `public/manifest.json`).

## 7. Security-Relevant Details

- **Authentication:** Google OAuth through Supabase Auth (`src/contexts/AuthContext.tsx:77-80`, `src/pages/LoginPage.tsx:114-145`)
- **Protected routes:** Unauthenticated users are redirected to `/login` (`src/App.tsx:157-176`)
- **Authorization / user ownership:** Strong per-user ownership is enforced in DB policies across profiles, accounts, categories, transactions, budgets, subcategories, savings goals, transaction rules, and credit card payments (`supabase/schema.sql:32-38, 126-129, 150-153, 181-184, 203-206, 231-234, 488-491, 535-538, 568-571`)
- **Cross-record ownership guards:** Trigger functions block transactions/budgets/subcategories from referencing rows owned by another user (`supabase/schema.sql:259-318`)
- **Row-level security:** Enabled broadly across core tables (`supabase/schema.sql` sections above)
- **Private receipt storage:** Receipts go into a non-public `receipts` bucket with file-size and MIME restrictions, plus object-level policies scoped to `auth.uid()` folder prefixes (`supabase/schema.sql:409-470`)
- **Signed access to stored receipts:** Client resolves receipt paths to short-lived signed URLs instead of exposing public bucket URLs (`src/lib/receiptUrls.ts:4-6, 55-70`)
- **Input validation:** Zod schemas validate transactions, accounts, budgets, goals, and profile fields on the client (`src/components/transactions/transactionFormSchema.ts`, `src/pages/AccountsPage.tsx:33-44`, `src/pages/BudgetsPage.tsx:43-50, 302-309, 537-538`, `src/pages/SettingsPage.tsx:35-41`)
- **DB-level constraints:** SQL schema adds checks for amounts, dates, account types, reminder ranges, and budget periods (`supabase/schema.sql`)
- **Data deletion/privacy handling:** Authenticated users can invoke `delete_user()` via RPC; UI also requires typing `DELETE` before destructive account removal (`supabase/schema.sql:81-95`, `src/contexts/AuthContext.tsx:101-112`, `src/pages/SettingsPage.tsx:558-603`)
- **Account deletion scope:** Deleting a user cascades through profile-linked data via FK relationships (`supabase/schema.sql` foreign keys on `user_id` references)
- **Offline/local data caveat:** The app stores offline mutation queues in `localStorage` and pending receipt blobs in IndexedDB; comments explicitly note these are device-local resilience stores, not secure secret storage (`src/lib/offlineQueue.ts:18-23`, `src/lib/receiptStore.ts:7`)
- **Conflict handling for offline sync:** Queue replay checks `updated_at` before applying stale updates (`src/lib/offlineQueue.ts:126-138`)
- **Security headers at deployment edge:** CSP, HSTS, frame denial, nosniff, referrer policy, and permissions policy are configured in `vercel.json:2-16`
- **Error-message hardening on login:** OAuth error text is only shown when expected params exist, then sanitized and length-limited (`src/pages/LoginPage.tsx:10-23`)
- **Dependency hardening signal:** `package.json` includes explicit `overrides` for several transitive dependencies (`package.json:56-62`)
- **Admin controls / RBAC:** No admin dashboard, admin role model, or RBAC beyond per-user ownership policies was found
- **Audit logs:** None found in the inspected repo
- **Custom API protection:** No custom API routes were found; security relies mainly on Supabase Auth/RLS plus client query scoping
- **Important caveat:** The rules UI claims auto-categorization, but `TransactionForm` calls `useTransactionRules()` with the hook default `enabled = false`, so rule auto-application may need owner confirmation before being presented as fully shipped (`src/hooks/useTransactionRules.ts:18-57`, `src/components/transactions/TransactionForm.tsx:48, 115-129`, `src/pages/CategoriesPage.tsx:760`)

## 8. Portfolio Case Study Copy

**Short card summary (40-60 words)**
Ledger is a self-hostable personal finance app built with React, TypeScript, and Supabase. It supports multi-account tracking, transaction management, budgets, savings goals, reporting, and privacy-aware user data ownership through row-level security, private receipt storage, and self-service account deletion.

**Longer case study summary (120-180 words)**
Ledger is a personal finance web application designed to give users full access to essential money-management features without subscription paywalls. The product covers account tracking, categorized transactions, recurring entries, budget monitoring with rollover history, savings goals, credit-card reminders, and exportable reports. On the frontend, the app is structured as a React/Vite single-page application with dedicated flows for dashboard analytics, account management, transactions, categories, reporting, settings, and legal/privacy screens. On the backend side, it uses Supabase directly for authentication, database access, and receipt storage rather than a custom server. The most portfolio-relevant security work is in the data model: row-level security policies across core tables, ownership guard triggers that prevent cross-user references, a private receipt bucket with user-scoped object policies, typed account deletion backed by an authenticated RPC, and deployment-level security headers in Vercel. Offline-friendly queues and local receipt staging were also implemented, with explicit tradeoffs documented in code comments.

**Resume bullets**

- Built a React + TypeScript + Vite personal finance application spanning dashboard analytics, account management, transaction workflows, budgeting, savings goals, reporting, and settings.
- Implemented direct Supabase integration for authentication, Postgres-backed CRUD flows, storage-backed receipt attachments, and self-service account deletion.
- Designed financial workflows such as recurring transactions, split transactions, bulk recategorization, CSV import, budget rollover history, and credit-card due-date reminders.
- Added reporting features including CSV/PDF export, saved date presets, net-worth trend analysis, and merchant/category breakdowns.
- Shipped a PWA-capable frontend with offline mutation queuing, local caching, and reconnect sync behavior.

**Cybersecurity-flavored bullets**

- Enforced per-user data isolation with row-level security policies across profiles, accounts, categories, transactions, budgets, savings goals, and transaction rules.
- Added ownership-validation triggers in Postgres to prevent cross-user foreign-key abuse between transactions, accounts, categories, and subcategories.
- Secured receipt uploads with a private Supabase Storage bucket, MIME/file-size restrictions, user-scoped object policies, and signed URL retrieval.
- Implemented authenticated self-service account deletion through a restricted Supabase RPC, plus destructive-action confirmation in the UI.
- Hardened deployment with CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options`, referrer policy, and permissions policy headers in Vercel config.

## 9. Suggested Screenshots

- Dashboard overview showing balance cards, cash-flow chart, budget progress, recent transactions, and credit-card monitor
- Transactions screen with filters, templates, tag chips, bulk select, and import flow
- Transaction modal showing recurring options, tags, savings-goal linkage, and receipt attachment
- Categories screen with expandable subcategories and auto-categorization rules dialog
- Budgets & Goals screen showing rollover-aware budgets, history tab, and savings-goal progress
- Reports screen showing export controls, date presets, net-worth chart, and merchant/category analytics

## 10. Gaps / Improvements

- Add a public live demo URL or clearly state “self-host locally” in the repo metadata; none is documented now
- Improve the GitHub repo description/topics; the repo remote is present, but the local repo does not document portfolio-facing topics/tags
- Add screenshots/GIFs to the README; current README is text-only
- Add a concise “Security Model” section to the README summarizing OAuth, RLS, ownership triggers, private receipts, and deletion flow
- Add automated tests; no test files and no `test` script were found (`package.json:7-10`)
- Add CI/security automation if desired; no workflow or dedicated security scanning config was found in the inspected repo
- Review the reports bundle size warning from production build; Vite reports a minified chunk over 500 kB
- Confirm or fix rule auto-application before claiming auto-categorization as shipped (`src/hooks/useTransactionRules.ts`, `src/components/transactions/TransactionForm.tsx`)
- If portfolio credibility matters for cybersecurity audiences, document offline-storage tradeoffs more explicitly because local queues/receipt staging use browser storage, not secure secret storage (`src/lib/offlineQueue.ts`, `src/lib/receiptStore.ts`)
