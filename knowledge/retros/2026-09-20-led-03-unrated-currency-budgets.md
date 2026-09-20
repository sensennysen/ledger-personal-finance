# LED-03 — Budgets and unrated-currency spend

- Ticket premise was wrong: no `convertAmount` existed, and Accounts/Reports have no excluded-currency warning. Budgets used `exchange_rate ?? 1`. Audit docs likely describe a different version — verify claims against src before planning.
- Decision: unrated foreign-currency spend is excluded and named (`UnratedCurrencyNotice`), not converted 1:1.

## Backlog
- DashboardBudgetProgressCard reads `budget.spent` (now excludes unrated spend) but shows no warning. Add `UnratedCurrencyNotice` there.
- Only the current cycle warns; past-period history/rollover silently exclude unrated spend.
- Accounts and Reports still use `exchange_rate ?? 1` with no warning — fold into LED-76 / a Reports ticket; reuse `UnratedCurrencyNotice`.
- Correct LED-03 CSV/ticket text ("Accounts and Reports both warn").
- Budgets page has an existing note "converted using their exchange rate" — now slightly inaccurate for unrated spend.
