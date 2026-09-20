# LED-12 — failed reads no longer render as empty states

## Pattern
`resolveLoadState({ loading, error, hasData })` (`src/lib/loadState.ts`) is the single decision for list views. `error` wins over `empty`; with data on screen it becomes `stale-error` (banner, keep data). Hooks must clear `error` on a successful fetch or a retry keeps showing the failure.

## Backlog
- Manual forced-network-failure check (browser, `navigator.onLine` true with Supabase blocked) not run — no browser in the session.
- `error` is only cleared on a successful fetch; a failed fetch followed by going offline keeps the banner until reconnect.
- Raw `error.message` sits under "Details"; user-facing copy mapping is LED-92.
- LED-51 must slot filtered-empty after the error check in Transactions/AccountTransactions.
- Other `use*()` consumers not touched: `useBudgets` list (own error banner exists), `useSubcategories`, `useTransactionRules` lists in CategoriesPage.
