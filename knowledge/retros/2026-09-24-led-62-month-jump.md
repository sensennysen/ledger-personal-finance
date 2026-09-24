# LED-62 · Month jump — retro (2026-09-24)

## What shipped
- `src/lib/monthJump.ts` (pure): `shiftMonthKey`, `monthKeyOf` (a date's cycle key, derived from `monthCycleRange` so start days such as 25 or 31 agree with the stepper), `buildMonthNets` (newest first from the current cycle, or later for future-dated rows, back to the oldest transaction; empty months kept; per-currency nets signed with `signedAmount`), `monthJumpTarget` (first day group of a month in list order and the rows needed to reach it).
- `src/components/transactions/MonthJump.tsx`:
  - `MonthRail` (lg+) shows the 5 newest months plus an "N earlier months" row that expands in place. It opens expanded when the active month is among the earlier ones.
  - `MonthJumpBar` (below lg) is a sticky "Jump to month" bar that opens a bottom sheet with the same list.
- `useRenderWindow` returns `ensure(min, key?)`. `TransactionDayList` sections carry `data-day` and a `scroll-mt` equal to the result bar height.
- Activity: a jump sets the shared cycle (same as the stepper) and scrolls to the top. The rail highlights the selected cycle.
- Account detail: a jump grows the window to the month's first day group and scrolls it under the result bar. If filters hide that month, they are cleared in the same update. On loan accounts the rail shows only on the Activity section.
- Rail and bar render only when the transactions read has data (`ready` or `stale-error`), so a failed read still shows the page's error state.

## Acceptance
- Right-hand rail (desktop) listing months with their net: PASS. Nets are unit-tested (per currency, account-relative on Account detail, transfers net to zero on Activity). Not seen live (see Backlog).
- Bottom-bar action (mobile): PASS by construction. Its position above BottomNav was not seen live.
- Jumping straight to any month: PASS. Unit-tested target and row math for both sort orders. The page wiring passes lint and build.
- Period stepper stays for single-step moves: PASS. `CycleStepper` and `pageChrome` are unchanged.
- Lint, build and test pass (155 tests, 10 new).

## Issues found in validate
- None blocking. Only the two list pages use `useRenderWindow` and `TransactionDayList`. `ensure` is additive, and `data-day`/`scroll-mt` are inert elsewhere. Setting the cycle from the rail affects Dashboard, Budgets and Reports exactly as the stepper does.

## Pattern
- `react-hooks/set-state-in-effect` rejects "decide in an effect, then set state". For a jump that may need a re-render (more rows, cleared filters) before its DOM target exists, decide in the click handler, store the target in a ref, and bump a counter. An effect keyed on the counter plus the render inputs only touches the DOM (find, scroll, clear the ref).
- When one update both changes a render window's reset key and asks for more rows, pass the new key with the request (`ensure(min, key)`). Otherwise the render-time reset discards the larger count.

## Backlog
- Not verified live: the test account has no transactions, so the rail and bar never render there. Seeding it would permanently change it (same call as LED-60/61). Unconfirmed in a browser: the rail at 1024–1920, the jump scroll landing under the result bar, dark mode.
- The mobile bar uses `bottom-[calc(88px+safe-area)]`, on the assumption that sticky offsets ignore `<main>`'s bottom padding. On mobile the add-transaction FAB (`bottom: 104px`, 64px tall, z-30) overlaps the right end of the bar. "Jump to month" sits on the left and stays reachable, but the overlap should be looked at live (lift the FAB when the bar is present, or move the action).
- "Select" in the 29a mobile bar is not in the LED-62 acceptance, so it is not built. Activity already has "Select multiple" in its filter sheet.
- The 29a rail also shows "Top categories, this filter" under the months. Not in the acceptance, so not built.
- Month nets use grey text as in 29a, and `-` rather than `−` (U+2212), matching the rows. Same unification item as LED-60/61.
- The rail takes the right-hand column at lg+. LED-99 (entry-detail pane at 1920) will need to share or replace it.
- Account detail has no active month: the rail doesn't highlight the month currently in view. A scroll-spy could add that.
- epic-5 CSV status for LED-62 was not edited.
