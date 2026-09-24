# LED-64 · Search: group, cap, count — retro (2026-09-24)

## What shipped
- `src/lib/globalSearch.ts` (pure):
  - `GROUP_CAP` 8 → 3 (design 29a).
  - `searchMatcher(query)` is the single row predicate for text (description, notes, account, to-account, category) or amount (exact / ±5%). `searchTransactions` is rebuilt on the same helpers with no behaviour change.
  - `inScope` and `searchTransactions` take an optional `accountId` and keep rows leaving or entering that account.
  - `categoryMatches` and `mergeCategoryResults`: a category shows up when its name matches or when matched transactions sit in it. Name matches come first, then categories by match count.
  - `buildHandoff`: where "See all" lands, the count that page will show, and the label.
- `useGlobalSearch` takes an optional account. It returns `transactionTotal`, `handoff`, and category rows with `matchCount` and a per-currency `matchSum` (`sumByCurrency`).
- `SearchPalette`:
  - Overall "N matches" in the scope strip, and "Heading · N" per group, with 3 rows per group.
  - "See all in Activity →" in the first transaction group heading.
  - "N more transactions" row as the keyboard path.
  - Category rows read "contains N “q” matches" plus the sum.
  - ⌘↵ hands off. ⌘F toggles "<Account> only" and is claimed only on `/accounts/:id`, so browser find still works elsewhere.
  - Desktop footer: ↑↓ move · ↵ open · ⌘↵ open in … · ⌘F filter this account only · esc close.
- `AppLayout` resolves the account from `useMatch('/accounts/:accountId')` and passes it to the palette.
- Activity and Account detail:
  - Both take `?q=` (also when already mounted), set the search, clear the type and tag filters, and then drop the param.
  - Both filter with `searchMatcher`, so the handed-off count equals the page's rows.

## Acceptance
- Results grouped by kind: PASS. Transactions (exact / nearby / text sub-groups for amount queries), Accounts, Categories, Actions. "Saved filters" is not built (see Backlog).
- Each group capped at 3: PASS (unit-tested).
- True count per group and overall: PASS by code. The overall count is transactions + accounts + categories; actions are not counted.
- "See all in Activity" handing off: PASS. Routing, labels and query encoding are unit-tested, and parity between the matcher and `searchTransactions` is unit-tested.
- Footer keyboard hints including ⌘F to scope to the current account: PASS by code, desktop only (the mobile footer is unchanged from LED-42).
- Lint, build and test pass (170 tests, 8 new).

## Issues found in validate
- [FIX NOW, fixed] An all-time search whose matches all fall outside the cycle offered "See 0 this cycle in Activity", which led to an empty list. The handoff now shows only when its count is > 0. The capped row then reads "N more, all outside this cycle" and is not clickable.
- Blast radius: both list pages now import `globalSearch.ts` (planned). No other callers of `inScope` or `searchTransactions`.

## Decisions
- Activity is bound to the cycle, so an all-time palette search can't hand off its full count. The label states the cycle count instead ("See 41 this cycle in Activity").
- An account scope hands off to `/accounts/:id?q=`, which shows the account's full history. The label is "See all in <account>", with no count.
- Activity and Account detail search now match amounts (exact / ±5%), notes and to-account names. This is a behaviour change, accepted in /plan so the counts line up.

## Pattern
- Seed state from a URL param without `set-state-in-effect`: keep `takenQuery` in state and compare it to `searchParams.get('q')` during render (the adjust-state-on-change pattern). The effect only removes the param from the URL.
- Palette counts and page filters share one pure predicate. A "See all N" label is only honest when both sides filter with the same rule.

## Backlog
- Not verified live: the test account has no transactions (same call as LED-60–63, don't seed it permanently). Unconfirmed in a browser:
  - group layout at 3 rows
  - the heading link inside cmdk's `aria-hidden` group heading (it is `tabIndex=-1`; the "N more" item and ⌘↵ are the accessible paths)
  - ⌘↵ and ⌘F in Chrome and Safari
  - the handoff landing on Activity and on Account detail, including when the target page is already open
- "Saved filters · N" group (29a): there is no saved-filter model. It needs a migration plus a save-filter UI on Activity. Suggest a new ticket.
- The Accounts group is kept from LED-40, although 29a doesn't show it.
- ⌘F has no touch equivalent on mobile. A mobile user can't scope search to an account.
- If Activity is in select mode during a handoff, the search applies but its input is hidden until select mode ends.
- Categories drawn in the palette are capped at 3 with name matches first, so a heavily matched category can fall below the cap behind a name-only match.
- epic-5 CSV status for LED-64 was not edited.
