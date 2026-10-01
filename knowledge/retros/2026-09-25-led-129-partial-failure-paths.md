# LED-129 · Partial-failure paths: account adjustment, undo, sign-out — retro (2026-09-25)

Four write paths reported the wrong thing when part of a write succeeded. They came from the LED-93 and LED-11 retro Backlogs.

## What shipped
- **Account adjustment.** `planAccountSave` (`src/lib/accountAdjustment.ts`) splits an edit into the account update and an optional balance-adjustment transaction. `useAccounts.updateAccountWithAdjustment` saves the account first; if the adjustment insert then fails it returns success (the form closes, the account did save) and shows a `partial` notification 'Account saved, balance adjustment not recorded' with a Fix. Fix reruns `recordBalanceAdjustment` only, so the account is never saved twice, and it re-notifies if it fails again. `useAccounts` now calls `useNotify`; every consumer sits under `NotificationProvider` (`AppLayout`).
- **Undo.** `restoreTransactionInput` (`src/lib/undoRestore.ts`) replaces the private `restoreInput` in `useUndoDelete` and adds `tags` and `goal_id`.
- **Sign-out after deletion.** `AuthContext.deleteAccount` checks the result of its final `signOut()`. The account is already gone, so a failure is shown through the existing sign-out banner (Try again calls `signOut()`) instead of throwing into `SettingsPage`'s 'Deletion failed' message.
- **Found in /validate:** with the sign-out failing, `deleteAccount` now returns instead of throwing, and `SettingsPage` only reset `deleting` in its `catch`, so the delete dialog stayed on 'Deleting…' with Cancel disabled and hid the banner. `handleDeleteAccount` now closes the dialog once `deleteAccount` returns.
- **Profile banner.** `fetchProfile` only sets the profile error when no cached profile was seeded.
- Tests: `tests/accountAdjustment.test.mjs`, `tests/undoRestore.test.mjs`.

## Acceptance criteria
- (a) Failed adjustment after a saved account says so, Fix retries only the adjustment: PASS by code. Not seen in the browser.
- (b) Undo restores tags and goal_id: PASS by unit test on the restore input. `createTransaction` spreads the values over the defaults, so they reach the insert.
- (c) A failed final signOut is shown: PASS by code.
- (d) Profile banner suppressed with a cached profile: PASS by code.
- (e) Pure parts unit-tested: PASS.
- (f) Lint, build and test pass: PASS (392/392).

## Backlog
- Not verified live: force the adjustment insert to fail (for example by blocking the request in devtools), confirm the notification, then Fix. Also a failed signOut after deleting an account, and the profile banner with a cached profile while the profile request fails.
- Undo while offline goes through `createTransaction`'s queue path; `buildOptimisticTransaction` was not checked for carrying `tags` and `goal_id` into the optimistic row.
- Clicking Fix dismisses the notification and reruns the step; on success nothing confirms it, the balance just updates. Same as the card-payment Fix. Worth a decision if a success toast is wanted.
- The split write is LED-130.
