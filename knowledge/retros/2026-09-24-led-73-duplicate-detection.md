# LED-73 · Duplicate detection — retro (2026-09-24)

Built first because it blocks LED-65 (commit 691e65f).

## What shipped
- `src/lib/importDuplicates.ts` (pure):
  - `normaliseDescription` lowercases, turns punctuation into spaces and drops digit runs of 4+ (card, reference and terminal numbers).
  - `matchDuplicates` keys on date + amount (to the cent) + type + normalised description. Each existing row matches at most once, and existing transfers never match.
  - `duplicateSpan` gives the file's date range.
- `useImportDuplicates(accountId, span)` reads the account's transactions in that span. It pages past PostgREST's 1,000-row cap (new rule: `knowledge/rules/page-reads-past-1000-rows.md`). A failed read returns `error`, and the dialog blocks the import behind a Retry button; it is never treated as "no duplicates".
- Dialog: a match is unticked by default, shows "already in Ledger" and names the matched row (date · description · amount). A tick opts it back in.

## Acceptance criteria
- Match on date + amount + normalised description before the write: PASS (unit-tested, including the three-day-overlap re-import).
- A match defaults to skip (unticked): PASS (unit-tested via `importableRows` in LED-65).
- The matched row is named: PASS by code.

## Backlog
- Not verified live (see the LED-65 retro).
- No in-file duplicate detection (the same row twice in one CSV). Two identical rows can be two real purchases, so this needs a product call first.
