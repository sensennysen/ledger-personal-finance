# LED-103 · Mobile add transaction uses the full form — retro (2026-09-25)

## What shipped
- `AppLayout`: the add sheet renders `TransactionForm` at every size, with the same `entryKind` and locked card/loan props as desktop. The mobile sheet chrome (`m3-bottom-sheet`, drag handle, `max-h-[90dvh] overflow-y-auto`) is unchanged.
- `TransactionForm`: the Amount input gains `inputMode="decimal"`, so phones raise the decimal pad.
- Deleted `QuickEntry.tsx` (keypad, chips, More details disclosure) and `src/lib/entryAmount.ts`. `tests/redesign.mjs` no longer loads or asserts keypad editing.
- Ticket created from add-transaction-spec §4, which no ticket covered. The 4c design caption still describes the keypad; the spec and the 2026-09-24 decision supersede it.

## Acceptance
- Mobile sheet renders TransactionForm with the desktop props: PASS (code; one render path left).
- Amount raises the OS keyboard (`inputMode="decimal"`): PASS (code).
- No keypad at any size: PASS (component and helper deleted; no references in `src` or `tests`).
- QuickEntry and entryAmount deleted, redesign test updated: PASS (lint, build, 305 tests and redesign checks pass).
- Every kind saves from the mobile sheet: PASS in code. The same `TransactionForm` already saves all five kinds on desktop, and `QuickEntry` already routed loan/card payments to it. Not exercised live.
- Sticky save, fits 390 x 844: PASS in code. The form footer is `sticky bottom-0` below `sm` inside the sheet's `overflow-y-auto`. Not exercised live.

## Issues found in validate
- None. The browser extension was not connected, and sign-in is Google OAuth anyway.

## Backlog
- Not verified live at 390 x 844: sheet height, pinned Save, iOS decimal pad, and a save of each of the five kinds.
- Behaviour mobile loses with QuickEntry (desktop never had it): last-used account (`ledger-last-account:<user>` in localStorage, now unread and left in place), the top-5 frequent-category chips, and the "Expense"/"Income"/"Transfer" fallback description. If wanted, add them to `TransactionForm` for all sizes in a new ticket.
- Update the 4c design caption in `Ledger - 2B Screens.dc.html`; it still says "mobile is a full sheet with the keypad".
