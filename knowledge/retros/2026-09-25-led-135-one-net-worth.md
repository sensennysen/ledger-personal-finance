# LED-135 · Home and Reports net worth follow Accounts' currency exclusion — retro (2026-09-25)

With an account in a second currency, Accounts showed a net worth that counted only the default currency, while Home and Reports added EUR to USD as if they were one currency. Three screens, three numbers.

## What shipped
- `summarizeBalances(accounts, baseCurrency)` in `src/lib/accountsOverview.ts`: `getBalanceSummary` over the base-currency accounts, net worth rounded to cents, plus `excludedCurrencies`. `getBalanceSummary` itself is unchanged.
- `buildAccountsOverview` takes its `netWorth` and `excludedCurrencies` from it, so Accounts, Home and Reports run one code path. Accounts already summed signed balances of base-currency accounts, so its figure did not change.
- Home: `useDashboardData` takes `baseCurrency` and returns `excludedCurrencies` in `stats`. The notice sits under Net worth on the phone card and on the desktop stat card (a new optional `note` on that card).
- Reports: the Net Worth stat card, the account panel's Net row, and the starting point of the net worth trend all use `summarizeBalances`, so the chart ends on the headline figure. The notice shows under the stat card and the Net row.
- `UnratedCurrencyNotice` takes an optional `subject` (default `'spend'`, so Budgets is unchanged); Home and Reports say "Excludes EUR balances — no exchange rate set."
- Inactive accounts: `useAccounts` fetches active accounts only, so all three screens already see the same set; Reports' extra `is_active` filter is redundant but harmless.
- Tests in `tests/accountsOverview.test.mjs`: mixed currencies, one currency, an overdrawn asset with Accounts equal to the shared summary, rounding, inactive accounts.

## Acceptance criteria
- (a) Accounts, Home and Reports agree, including with a second currency: PASS by code and unit test (same function, same inputs). Not seen on screen.
- (b) Excluded currencies named on Home and Reports: PASS by code.
- (c) Summary unit-tested with mixed currencies and inactive accounts: PASS.
- (d) Lint, build and test pass: PASS (402/402).

## Backlog
- Not verified in the browser: an account in a second currency, then Home (phone and desktop), Reports and Accounts side by side, in both themes. The notice placement was my call (no design frame).
- The Reports net worth trend still subtracts every transaction, in any currency, from a base-currency-only total (`netWorthEffect` ignores currency, the LED-71 retro item). Its latest point now matches the headline; earlier points can be off when an excluded-currency account has transactions.
- Home's credit-card and loan debt totals now also count base-currency accounts only, since they come from the same summary.
- The Home 'balance' detail view was not checked for a currency mix.
- Converting instead of excluding needs a rate source: LED-136, blocked on OD-3.
