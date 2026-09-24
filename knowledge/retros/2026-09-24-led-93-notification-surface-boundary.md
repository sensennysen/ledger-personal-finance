# LED-93 · One notification surface + recoverable boundary — retro (2026-09-24)

## What shipped (`69dd2d5`, `7fe0141`)
- `NotificationProvider` (in `AppLayout`) renders one surface; `useNotify()` from `src/contexts/notificationState.ts` reports to it. Rules live in `src/lib/notifications.ts` (tested):
  - success: Undo, closes after 5 s, `role="status"`;
  - failure: Retry, and partial failure: Fix. Both stay until the user acts, `role="alert"`;
  - one at a time, and a dismiss only closes the notification it was aimed at.
- `ui/undo-toast.tsx` deleted. `useUndoDelete` holds the delete/undo flow the two transaction pages had duplicated.
  - Delete failures, which were console-only before, show Retry.
  - An undo that partly restores says how many transactions are still deleted.
- Card payment (`AccountTransactionsPage`) is the real partial failure:
  - once the transfer saves, the form clears;
  - if the payment record or the statement update then fails, the user gets "Payment recorded, statement not updated", and Fix reruns only the steps that failed.
- `ErrorBoundary` wraps the routed page content and the entry detail, with copy from the design ("This section didn't load …"), "Reload this section" and "Copy error details". `App.tsx` keeps `variant="app"` as the last resort, which reloads the page.
- BudgetsPage bars and warning text use `primary` (GOLD) / `income`.

## Acceptance (browser, local user, 1280 and 390, dark and light)
- One surface with three severities — PASS.
  - Success + Undo: deleted "Coffee", Undo restored it (row back, DB row present).
  - Failure + Retry: `transactions` blocked → "Couldn't delete that transaction / Nothing was deleted." → unblock, Retry → success with Undo.
  - Partial + Fix: `credit_card_payments` blocked → partial → unblock, Fix → "Statement updated for BPI Rewards Visa". The DB ended with exactly 1 transfer, 1 payment and `statement_paid_amount` 100, so the card was not paid twice.
  - At 390 the toast sits at 606–660px, above the FAB and the bottom nav (top 756px). The layout geometry test now reads `notification.tsx`.
- Error boundary scoped, with a stated safe state and a recovery action — PASS. A temporary throw in CategoriesPage (removed after the check) showed the fallback while the header and nav kept working (18 links). "Reload this section" recovered, and navigating to Accounts cleared it.
- BudgetsPage uses GOLD/INCOME tokens — PASS.

## Issues found in validate
- `[&>div]:bg-*` coloured the Progress **track**, not the indicator, so every budget bar looked full whatever was spent. The bug predates this ticket (yellow-500 did the same) and the Dashboard budget card had the same selector. Fixed in `7fe0141` by targeting `[data-slot=progress-indicator]`. Verified: 99% and 33% now fill 99% and 33% of the track.

## Backlog
- `updateAccountWithAdjustment` can half-succeed: the account saves, then the balance-adjustment transaction fails. It returns an error as if nothing saved. Move it to the partial + Fix pattern.
- `TransactionsPage` split: `await deleteTransaction(splittingTx.id)` ignores its result. If creating the children succeeds but the delete fails, the amount is counted twice. This is a partial-failure candidate.
- Undo restores the same fields as before this ticket and drops `tags` and `goal_id`. Present before this ticket.
- Not checked with a screen reader. The surface is inserted together with its text, and some readers skip `role="status"` content that arrives already inside the element. A persistent live region would make announcements reliable.
- Decision (a): "Report a problem" is labelled "Copy error details" because there is nowhere to send a report. Confirm with design.
- Decision (c): no per-widget boundaries on Dashboard. The page content boundary covers it.
- On BudgetsPage's main card, anything below the warning threshold falls back to `bg-primary` (the same as Dashboard), not `income`. Confirm with design.
