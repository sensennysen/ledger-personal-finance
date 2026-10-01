# A transaction's `exchange_rate` of 1 is the default, not a rate

`transactions.exchange_rate` is `numeric not null default 1`, and the entry form never asks for it on an expense or income (it only forces `currency` to the account's). Every foreign-currency expense therefore carries a rate of exactly 1. Code that read `exchange_rate ?? 1`, or treated "not null" as "rated", counted foreign spend one to one, and the LED-03 "unrated spend is excluded and named" path could never trigger on a row read from the database.

**Why:** found while building LED-136. A budget in PHP counted a USD 10 expense as PHP 10.

**How:**
1. Convert a transaction's amount with `amountInCurrency(tx, target, table)` in `src/lib/exchangeRates.ts`: same currency as is, a recorded rate (not null and not 1) honoured, else the exchange-rate table, else `null`.
2. `null` means leave it out of the total and name the currency (`UnratedCurrencyNotice`), never fall back to 1.
3. Income and expense totals on Home, Reports and Activity still add native amounts (LED-136 retro, Backlog). Do not copy `t.amount * (t.exchange_rate ?? 1)`.
