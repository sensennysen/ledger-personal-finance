# LED-108 · Kind menu: Liabilities group, live descriptions, gold loan tile — retro (2026-09-25)

## What shipped
- `src/lib/kindMenu.ts` (pure, relative imports): `kindMenuItems(accounts, { baseCurrency, showLoanRepayment, showCardPayment, formatMoney })` returns the three primary kinds, then Loan repayment and Card payment in a `liabilities` group. `TransactionKindMenu` maps over it; it hard-codes no label or description.
- Live text: "2 loans · $14,180.00 owed" (`summarizeBalances(...).totalLoanDebt`), and for cards "{name} · {amount} due" for one card or "{n} cards · {total} due" for several.
- Visibility is unchanged: any loan account, or a credit card with a non-zero balance. Only the sentence is restricted to the base currency (LED-135); a liability that exists only in another currency falls back to the old static text.
- Dropdown is `w-80` with a second kicker label "Liabilities". Loan tile is `bg-gold/15` with a `text-gold` icon (gold is a fill, never text); the card icon is `text-expense` on `bg-muted`. The `bg-primary/10` grounds are gone.

## Deviations
- The ticket says "the card with the nearest due date, or '{n} cards'". The spec's rule reduces to one card named, several counted, so no due-date sort was built. `daysUntilDayOfMonth` is not used.
- The ticket names `summarizeBalances` in `src/lib/creditCards.ts`; it lives in `src/lib/accountsOverview.ts` (`creditCards.ts` has `getBalanceSummary`).
- No gold tint token was added; `bg-gold/15` measures fine. LED-139 or LED-141 can add the design's page tint.

## Acceptance criteria
- (a) A "Liabilities" label separates Loan repayment and Card payment: PASS (browser).
- (b) Live counts and totals, plural handling tested: PASS (unit and browser).
- (c) Loan tile uses `--gold` in both themes, card icon uses the expense token: PASS (browser: `#C9AC6A` dark, `#917738` light).
- (d) `w-80`, no description wraps at 1280: PASS (browser: every description is one line high).
- (e) `hasLoans` and `hasCardBalance` rules unchanged: PASS (unit, one test per flag).
- (f) Items come from `kindMenuItems` and are unit-tested: PASS.
- (g) Lint, build, test: PASS (480/480 at the end of the phase).

## Backlog
- A highlighted dropdown row recolours its icon: `DropdownMenuItem` has `focus:**:text-accent-foreground`, so the gold loan icon reads as the accent while hovered or arrowed onto. Same as every other row; not changed here.
- Not checked in a browser: Dashboard and account-page triggers (only Activity was opened), and a user with one card, a zero-balance card, or a second-currency loan (unit tested only).
- The description is not gold-tinted text, so no contrast pair was added to `themeContrast.test.mjs`; the icon-on-tint pair is not measured.
