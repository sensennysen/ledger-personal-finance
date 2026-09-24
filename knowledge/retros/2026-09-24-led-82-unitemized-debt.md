# LED-82 · Unitemized-debt reconciliation, permanently — retro (2026-09-24)

## What shipped
- `getItemizationGap(owed, purchases)` in `src/lib/loanSummary.ts` (tested). `itemized` is the sum of each purchase's `remaining_balance`, and `gap = owed − itemized`. The purchase trigger adds `total_payable − paid` to the loan, so a loan whose purchases cover it owes exactly `itemized`.
- `LoanPurchaseTracker` shows a warning band whenever the gap isn't zero:
  - gap > 0: "Some of this loan isn't itemized" (or "None of…" when there are no purchases).
  - gap < 0: "The purchases add up to more than this loan owes".
  - Action: "Set the loan amount to $itemized". It goes through `updateAccountWithAdjustment` via the page's `onSetLoanAmount`, the same path as editing the balance in the account form, so it leaves a Balance Adjustment transaction. The action is shown only when purchases exist; on an empty list it would read "set to $0".
- The Add dialog's note shows when gap > 0, not only on an empty list. It names the gap and says to lower the loan amount by that much, not "set it to 0".

## Decisions
- **"Add it as a purchase" (from the design) is not built.** Adding a purchase raises the balance by its total, so the gap never closes. See Backlog.
- The band shows only for a settled read (`ready`/`empty` and not loading). A stale or in-flight list could show a gap that isn't there. This is stricter than the plan, which also allowed `stale-error`.

## Acceptance
- Warning on the tracker whenever the figures disagree, not only on an empty list: PASS.
  - Unit: 6 tests.
  - Browser, 390/1280/1920: a $400 gap shows the band. Clicking "Set the loan amount to $8,280.00" wrote a $400 income adjustment and the band cleared. With a negative gap (owed $7,000 vs $7,670 itemized) the "more than this loan owes" band shows and the Add dialog note stays hidden.

## Backlog
- **"Add it as a purchase"** needs one atomic write: create the purchase and lower the loan balance by the gap. That means an RPC (a migration), because two client writes can leave the debt counted twice.
- Right after a purchase is created, `useLoanPurchases` refetches before the page refetches the account. A false gap could flash for one render. The `!loading` guard covers the loan read, not the account read. Not observed in the browser.
