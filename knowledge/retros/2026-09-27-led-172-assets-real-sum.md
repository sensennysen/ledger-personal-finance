# LED-172 · Accounts Assets total is the real sum — retro (2026-09-27)

## What shipped
- `buildAccountsOverview` (`accountsOverview.ts`): `totals.assets` is now the real sum of counted asset balances (option a, recommended), so an overdrawn asset lowers it instead of floor­ing at 0. `sharePct`'s denominator stays the sum of positive balances only (renamed `positiveAssets`), so an overdrawn row's share is still 0% and the positive rows still sum to 100% — they don't shrink just because the tile's total did.

## Acceptance (live re-run: headless Chrome over CDP, seeded user — Checking $3,200, Cash Wallet −$200, Rewards Visa −$450 credit card, two loans)
- (a) Assets − Liabilities = Net Worth on screen for an overdrawn asset: **PASS, live**. Accounts read Assets $3,000.00 (= 3200 − 200, the real sum), Liabilities $6,500.00, Net Worth −$3,500.00; 3000 − 6500 = −3500. Also PASS via `tests/accountsOverview.test.mjs`.
- (b) share bars still sum to 100% of the positive balances: **PASS, live** — Cash Wallet's row read 0%, Checking (the only positive asset) read 100%.
- (c) unit test with a negative asset: PASS.
- (d) Home net worth unchanged (LED-135): PASS by code trace — Home and Reports read `summarizeBalances`, not `buildAccountsOverview`'s `totals.assets`; that function and its real-balance netWorth math were not touched.

## Backlog
- No "Overdrawn" line was added (recommended option a keeps the negative row itself as the only indicator); if a live look finds that unclear, LED-181's decision register has the other two options (put overdrawn accounts under Liabilities, or add an explicit line).
