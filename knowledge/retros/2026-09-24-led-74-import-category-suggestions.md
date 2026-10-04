# LED-74 · Category suggestions — retro (2026-09-24)

Epic 6 phase 3, second ticket (commit 3b3b1c3, validate fix 422dda2).

## What shipped
- **`src/lib/importCategories.ts` (pure).**
  - `buildPayeeMemory`: normalised payee + type → the category it was most often filed under. A tie goes to the most recently used. It reuses LED-73's `normaliseDescription`, so "GRAB *RIDE 4471" and "Grab Ride 8812" count as the same payee.
  - `suggestCategory`: tries rules first, highest priority first, using the same substring match as entry. Falls back to the memory. Only categories that fit the row's type (or are `both`) are suggested.
- **`useImportCategoryMemory(fileKey)`.**
  - Reads every categorised transaction through `readAllPages`, plus `transaction_rules`, fresh for each file.
  - It reads the rules itself because `useTransactionRules` drops read errors.
  - A failure shows the error with Retry and doesn't block: rows fall back to `Choose…`.
  - While the read is in flight, Import says "Matching categories...".
- **Dialog.**
  - The Category column is a single control holding a category (tagged "auto" when suggested), `Choose…`, or LED-75's transfer.
  - Rows with no match get a new warning cause, "No category match". It imports anyway and can be skipped.
  - Both apologies are gone: the hint box and "bulk re-categorize" on the success screen.

## Acceptance criteria
- A payee → category memory from past transactions gets most rows right: **PASS** by unit test (normalised payees, majority vote, per-type, rules win, wrong-type or deleted categories never suggested). The real hit rate on a user's own history hasn't been measured.
- The rest show `Choose…` inline: **PASS**, checked by reading the code and unit-tested through the `no-category` cause.

## Issues found in validate
- **[FIX NOW, fixed in 422dda2]** "No category match" also counted error rows and unticked duplicates, which stay out anyway. They're now excluded.
- **[FIX NOW, fixed in 422dda2]** The memory was read once per dialog mount, so a second import in the same session didn't learn from the first. It is now keyed on the file.

## Backlog
- **Not verified in a browser** (see the LED-75 retro). Unconfirmed: the Category Select inside the table, and the dialog layout at 375.
- **Descriptions the user renamed in Ledger** ("Jollibee" for "JOLLIBEE ORTIGAS 0231") don't match the bank's raw text. The memory learns from past imports, not from edited entries.
- **Subcategories are never suggested.**
- **Picking a category for one row doesn't apply it to other rows with the same payee.** The mockup doesn't ask for this, but it would cut the remaining `Choose…` work.
- **No "save as rule" from an import pick.**
