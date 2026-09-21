# LED-40 — Search palette v1

## Pattern
Matching lives in `src/lib/globalSearch.ts` (pure, relative imports, 13 tests). The cycle is an argument (`scope` + `range`), never read inside the module, so the palette states which range it searched. `SearchBody` mounts only while the dialog is open, so `useTransactions/useAccounts/useCategories` do not run a second time at app load. `AppLayout` owns the palette and reuses `openAddTransactionModal` and `EntryContext`, so no form plumbing was added.

## Decisions
- "Payees": `Transaction` has no payee field. Search covers description, notes, account, to-account and category names.
- E / I / T on Actions fire only after arrowing onto an action row (reset on typing). Firing on an empty query would hijack searches starting with e, i or t. `TransactionKindMenu` has no key bindings today (spec 1.5 is unbuilt) and was not touched.
- Full history is searched client-side; the transactions fetch has no cap. Ceiling is ~2,000 per account.
- Group cap is 8 with true totals and "Show all N in Activity" (LED-64 sets the design cap of 3).
- "Show all N in Activity" only navigates to `/transactions`; Activity has no query param to receive the search.

## Acceptance
- Searches descriptions, payees, accounts, categories: PASS (payee = description, see above).
- Numeric queries: exact, then +/-5%: PASS (unit tested, incl. boundary).
- Grouped Transactions / Accounts / Categories / Actions: PASS by code, not seen rendered.
- Actions reuse E / I / T: PARTIAL, own key caps, gated on arrow navigation.
- Explicit cycle toggle, default current cycle: PASS by code, not seen rendered.

## Backlog
- Not checked in a browser: Cmd/Ctrl+K toggle (incl. focus in a field), dialog width, group layout at desktop/tablet/mobile, the header icon on mobile, and close-then-open with the add-transaction modal (focus restore).
- Cmd+K also opens over other open dialogs; unchecked whether that stacks badly.
- The E / I / T gating is a judgement call; confirm against design 16a in a browser.
- Activity cannot receive a query or scope from "Show all N".
- Category rows go to `/categories` (no per-category page); design's "Edit the budget" and "New expense in <category>" actions are not built.
- Empty state (LED-41), mobile full-screen (LED-42), cap of 3 and Cmd+F (LED-64) are separate tickets.
- CSV status for LED-40 left as To Do until the browser check is done.
