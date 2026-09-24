# LED-95 · First load ≠ refetch — retro (2026-09-24)

## What shipped
- `src/lib/loadState.ts`: `resolveRefresh({ loading, hasData, dataKey, requestedKey })` (pure). It marks data on screen as belonging to a different key than the one loading, and names the key that is loading. `resolveLoadState` and the `LoadState` union are unchanged, so none of its 25 callers changed.
- `useBudgets`: stepping to an uncached cycle keeps the previous cycle's budgets instead of clearing them. The hook tracks which cycle they belong to (`dataKey`), never caches them under the new key, and returns `refreshing`. A failed or offline read for a new cycle clears the old data, so the page shows its error state.
- `RefreshingRegion` (`src/components/ui/refreshing-region.tsx`): keeps content mounted (so scroll position is kept), dims it to 60% with `aria-busy`, and shows a 2px progress rule plus a `role="status"` label ("Loading October 2026…"). The rule is a sweep that becomes a static bar under reduced motion (`index.css`).
- Budgets (Budgets and History tabs) and Home's budget card use it. Home also pauses spending alerts while refreshing.
- Budgets now goes through `resolveLoadState`. It used to render its error as a paragraph above a "No budgets yet" card, which broke the read-failures rule.
- Activity, account activity and the budget-transactions dialog show skeletons only on `loadState === 'loading'`, not on every refetch.
- Shell: `isSetupComplete(progress, { loading })`. Before this, the LED-52 nav lock treated "accounts/transactions still loading" as "setup not done", so every tab was locked on the first frame. An unknown answer now counts as complete, unless the locally stored cycle flag already says it isn't.

## Acceptance
- Previous cycle stays visible at reduced opacity, with a progress rule and a named loading target: PASS in code on Budgets and Home. Activity and Reports filter the cycle in the client, so stepping there never refetched and had nothing to flash. `resolveRefresh` is unit-tested. Not seen live (see Backlog).
- Scroll position preserved: PASS by construction. The region never unmounts its children.
- Shell (nav, stepper, title, primary action) interactive from the first frame with no skeleton: PASS in code. The shell renders no skeleton, and the nav lock no longer waits on queries. Not seen live.
- Lint, build and test pass.

## Issues found in validate
- [FIX NOW, fixed in 41cce2e] Home read `useBudgets` too. Once the hook kept the previous cycle, Home showed last cycle's spend, not dimmed, and alerted on it. It now wraps the card in `RefreshingRegion` and hands alerts a stable empty list while refreshing.

## Pattern
- See `knowledge/patterns/keep-previous-data-with-its-key.md`.

## Backlog
- Not verified live. Sign-in is Google OAuth, which the agent can't complete. Unconfirmed in a browser: the dim, rule and label on Budgets and Home, the reduced-motion static rule, and a nav with no lock flicker on first load.
- 13th Month is keyed by year and still swaps to skeletons when the year changes. It's not a month cycle, so it wasn't in scope.
- `RefreshingRegion` sets `pointer-events-none` while refreshing, so you can't click an old-cycle row during a load. That's intentional, but check that it feels right on slow connections.
