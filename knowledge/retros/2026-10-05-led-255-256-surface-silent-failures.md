# Epic 21 · LED-255 · LED-256 — failures that only reached the console — retro (2026-10-05)

Branch `main`. Two backlog items from the LED-240 and LED-232 retros, against AGENTS.md's "auth and sync failures are surfaced to the user, not swallowed".

## What was done
| Ticket | Change |
|---|---|
| LED-255 | `SubcategoryPanel` notifies "Couldn't change the order" on a failed subcategory reorder, as the category list does. `updateSubcategoryOrder` gets the offline guard `updateCategoryOrder` has. |
| LED-256 | `generateDueRecurring` returns `readFailed: true` when its read fails, instead of looking like "nothing due". `recurringRunNotice` (pure, in `src/lib/recurringTransactions.ts`, 3 new tests) words the notice for a failed read and for failed posts; `AppLayout` shows it with Retry. `RecurringRun` moved to the lib and is re-exported from the hook. |

## Verification
- `pnpm lint`, `pnpm build`, `pnpm test`: 1015 pass.
- Browser pane, local Supabase, demo user. `fetch` patched in the page so only the target requests fail; nothing touched the database.
  - LED-255: subcategory `PATCH` rejected, "Move Coffee down" in Food & Dining → notice "Couldn't change the order · Couldn't reach the server. Check your connection and try again. Nothing was changed."; Coffee stayed first.
  - LED-256: the `is_recurring=eq.true` read rejected, sign out and in (the generator runs once per layout mount) → "Couldn't check recurring transactions" with Retry. Real `fetch` restored, Retry → no notice.

## Backlog
- The offline path of LED-255 was read, not driven (`navigator.onLine` false). It returns before any write, as the category reorder does.
