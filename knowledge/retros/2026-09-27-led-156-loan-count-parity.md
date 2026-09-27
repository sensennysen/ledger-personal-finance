# LED-156 · Palette and kind menu count the same loans — retro (2026-09-27)

## What shipped
- `loansOwed(accounts, currency?)` added to `src/lib/loans.ts`: the one definition of "how many loans" — loan accounts with `getLoanAmountOwed(account) > 0`, optionally restricted to one currency. Both surfaces now call it (one-list-two-surfaces pattern, `knowledge/patterns/one-list-two-surfaces.md`).
- `kindMenu.ts`'s `loanRepaymentDescription` uses `loansOwed(accounts, baseCurrency)` instead of its own inline filter — a repaid loan no longer counts (it previously counted every loan account regardless of balance).
- `globalSearch.ts`'s `summarizeLoans` (which counted distinct purchases from `deadlines`) is removed; `useGlobalSearch.ts` now derives `loanSummary` from `accounts` via `loansOwed`, uncurrencyfiltered (matching its prior scope — it never filtered by currency before either).

## Acceptance (live re-run: headless Chrome over CDP, seeded user with 2 loan accounts and 4 purchases — Phone Loan $350 owed, Car Loan $5,700 owed)
- (a) Palette and menu show the same count for the same data: **PASS, live**. Add Transaction menu: "Loan repayment · 2 loans · $6,050.00 owed". Search palette's Record section: "Loan repayment · 2 loans, $6,050.00 owed". Identical count and amount on both surfaces, for 2 loan accounts holding 4 purchases between them.
- (b) one helper, one unit test: PASS — `loansOwed` in `loans.ts`, tested in `tests/loans.test.mjs`; `tests/kindMenu.test.mjs` and `tests/globalSearch.test.mjs` updated for the new behaviour at each call site.
- (c) owed amounts still agree: PASS, live — both surfaces read $6,050.00.

## Backlog
- **Decision applied ahead of LED-181**: "does a fully repaid loan count" was resolved here as **no** (matches the existing credit-card precedent: `hasCardBalance` already excludes a zero-balance card). If LED-181's answer differs, revisit `loansOwed`'s predicate — it's the only place this logic lives now, by design. Not re-tested live (would need a seeded fully-repaid loan account), but covered by `tests/loans.test.mjs` and `tests/kindMenu.test.mjs`.
