# LED-136 — Live exchange rates with a user-set refresh frequency — retro (2026-09-26)

## What was built
- OD-3 (b), with the frequency the user asked for. Rates come from `https://api.frankfurter.dev/v2/rates` (no key, CORS open, the ECB-based v1 endpoint carries a deprecation header so it was not used) into the existing `exchange_rates` row. `rates[C]` is units of C per 1 base; `overrides` uses the same units and wins; a fetch never replaces an override. If the default currency changes, overrides are re-expressed against the new base (`rebaseOverrides`) or dropped.
- Migration `20260926120000`: `profiles.exchange_rate_refresh` (`open`, `daily`, `weekly`, `manual`; default `daily`), `exchange_rates.fetched_at` (`updated_at` also moves when an override is edited, so it cannot say when a refresh is due), and `transactions.original_amount` / `original_currency` with a both-or-neither check. Replayed all 23 migrations into an empty scratch database (schemas cloned from the local Supabase, since `db reset` would have wiped the local data) and ran `supabase db lint`.
- `src/lib/exchangeRates.ts` is pure: `lookupRate`, `converterTo`, `amountInCurrency`, `refreshDue`, `parseFeed`, `rebaseOverrides`. 23 tests.
- `ExchangeRatesProvider` (one for the app shell) reads the row, fetches when `refreshDue` says so (once per app load, again if the base changed) and never while offline. `ExchangeRatesCard` in Settings: frequency, Refresh now, last fetched and as-of date, one row per needed currency with "Use my rate" and Clear, and the failure text with the raw detail collapsed.
- Consumers: Accounts (converted rows show "≈ ₱…", totals and shares use converted values, footnotes name converted and excluded currencies), Home and Reports net worth (`summarizeBalances`), budget spend, Overspending, "Add from last cycle", a budget's transaction list and an entry's budget bar (`amountInCurrency`), and the import (rate prefilled, statement amount and currency stored, duplicates also match on them).

## Live checks (local Supabase, real feed, test user removed after)
- Accounts, Home and Reports all showed the same net worth (USD 35,224.86 with a EUR and a PHP account) and Budgets showed 89.44 for PHP 5,600 at 62.611.
- Frequency saved to the profile; a typed PHP rate (60) showed "your rate", survived Refresh now; a blocked feed showed "Couldn't reach the rate feed" and kept the stored rates; changing the default currency to PHP fetched against PHP and rebased the overrides.
- Import of a USD statement into a PHP account prefilled 62.611 with "Filled in from the exchange-rate feed"; rows stored converted with `original_amount` 10.00 and `original_currency` USD; importing the same file again at a rate of 58 still flagged both rows as duplicates.
- Phone width (390): no horizontal overflow; dark theme captured.

## What live checks found that the suite did not
1. **The CSP blocked the feed.** `connect-src` allowed only Supabase and Google. Fixed in `index.html` and `vercel.json` (see `patterns/outbound-host-needs-csp.md`).
2. **`useBudgets` required the provider and blanked `/data-deletion`** for a signed-in user (the same trap as `patterns/hooks-on-public-pages.md`, which I had not re-read). Fixed with `useOptionalExchangeRates`, a test that pins it, and step 4 added to that pattern.
3. **`exchange_rate` is `not null default 1`,** so foreign spend was counted one to one and the "unrated" path never fired (`rules/foreign-currency-rate-of-one-is-not-a-rate.md`).

## Decisions
- A recorded rate on a row (not null, not 1) wins over the table; the table wins over nothing; no rate means excluded and named, never 1.
- Historical spend converts at today's rate: there is no per-date rate.
- The scheduled fetch is at most once per app load, so a failing feed is not retried on every screen. Offline at load means no automatic fetch that session.

## Backlog
- **Income, expense and category totals are still mixed-currency sums** on Home (`sumTransactionsByType`, cash flow, the expense pie), Reports (`summarizeRange`, `buildCategoryBreakdown`, the flows chart) and Activity's "Top categories". With a foreign account, Budgets now shows the converted spend and the pie beside it does not (live: 89.44 against 5,600). Needs its own ticket: convert income and expense rows into the default currency once (`amountInCurrency`), leave out and name what has no rate.
- Reports' net-worth-over-time walks back from today's converted net worth using native transaction amounts, so it mixes currencies for a foreign account (it also did before, in the other direction).
- The Data deletion page's export of budgets has no rates, so foreign-currency spend is left out of its "Spent" column.
- Cross-currency transfers still need a second rate (item (f) of the ticket) and the mixed-currency "A + B" totals in Overspending (item (e)); neither was in the approved plan.
- **Privacy Policy** lists Google and Supabase as third parties and now the browser also contacts `api.frankfurter.dev` (currency codes and the visitor's IP). Legal text: it needs the product owner.
- Frankfurter is a free public API with no SLA. If it goes away the app degrades to "no rate: left out of totals" and typed rates; a different host means changing `FEED_URL` and both CSP strings.
- The Settings status says "Rates · fetched …" when no currency needed a fetch and nothing was requested.
- Self-hosters must apply the three migrations: the import's duplicate check now selects `original_amount`, so an unmigrated database fails that check.
- Not run: `every time I open` and `weekly` live (unit tests only), the offline queue with `original_amount`, an import of transfers between currencies, a real iOS device, a screen reader.
