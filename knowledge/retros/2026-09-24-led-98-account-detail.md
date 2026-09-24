# LED-98 · Account detail — retro (2026-09-24)

## What shipped
- A breadcrumb (Accounts › name) replaces the back chevron. The single `h1` is kept (LED-30).
- One ruled band:
  - Cards: balance · limit + % used · statement closes · payment due, plus a utilisation bar.
  - Loans: outstanding · repaid · next payment · schedule, plus a repayment meter.
  - Others: balance · income · expenses · transfers.
- A right pane at lg:
  - Pay this card: amount to pay, and the existing payment logger and history moved unchanged.
  - Next payment (loans).
  - Where it went: this cycle's spending from the account, via `buildCategoryBreakdown`.
  - Account facts.
- Loan progress comes from the shared `loanProgress`.

## Acceptance
- Breadcrumb replaces the back chevron: PASS (browser).
- Balance / limit / statement / due in one band: PASS (browser, 1920 and 390).
- Right pane with payment and category breakdown: PASS (browser, 1920).

## Issues found in validate (`ae02c06`)
- Below lg the whole pane stacked above the list, so transactions started about 1,250px down. Only Pay this card stays above the list now.
- The header cut the name to "B…" on phones. The actions wrap under the name, and Edit account is an icon button.
- A loan's Summary tab left the left column empty. The panes now span both columns there.
- Dates and the schedule in the band used the money face.

## Backlog
- **Two card-payment paths remain.** The header's Pay card goes through `TransactionForm`. The pane's Record payment writes `credit_card_payments` and `statement_paid_amount`. Only the second updates "Amount to pay". Merge them into one.
- Where it went and the account facts are hidden below lg. The mobile design (4a) doesn't show them either, but they're unreachable on a phone.
