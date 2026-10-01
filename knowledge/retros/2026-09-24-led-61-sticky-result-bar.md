# LED-61 · Sticky result bar — retro (2026-09-24)

## What shipped
- `src/lib/transactionWindow.ts` (pure): `TxSort` ('newest' | 'oldest'), `sortByDate` (stable within a day), `sumByCurrency` (signed like the rows, per currency), `dateSpan`; `groupByDay` takes an optional sort (default 'newest', existing callers unchanged).
- `src/lib/formatNet.ts`: `formatNet` moved out of `TransactionDayList.tsx`. Exporting a non-component from a component file fails `react-refresh/only-export-components`.
- `src/components/transactions/ResultBar.tsx`:
  - `ResultBar` shows "{n} transactions match", "of {total} {label} · {range}", "Sum {per-currency}", a sort toggle and a Compact density toggle (aria-pressed).
  - On mobile the bar is shortened to "{n} match · Sum …" plus an icon-only sort button, as in 29a mobile.
  - `ResultBarLayout` pins the bar (`sticky top-0 z-20` in `<main>`) and publishes its measured height as `--tx-list-sticky-top`, so the LED-60 day headers stack under it.
- `usePreferences`: `txDensity: 'comfortable' | 'compact'`. `TransactionRow` takes an optional `dense` prop (`px-3 py-2`, 32px icon tile).
- Activity: total is the cycle count ("of N this cycle"), range is the cycle, sum is Activity-signed (transfers net to zero).
- Account detail: total is "of N on this account", range is the account's first to last month, sum is relative to the account.
- Sort is page-local and part of the render-window reset key.

## Acceptance
- Match count: PASS.
- Count of total on the account: PASS on Account detail. On Activity, which has no account filter, the total is the cycle's count, the same number the filtered-empty state already shows. Design 29a draws Activity with an account chip applied; revisit if Activity gains an account filter.
- Active range: PASS. Activity shows the cycle; Account detail shows the history span by month.
- Sum of the match: PASS, per currency and never added across currencies. Unit-tested.
- Pinned above the rows and persisting while scrolling: PARTIAL. Correct by construction: the sticky wrapper's parent spans the whole list, and the day headers read the measured height. It was not seen live (see Backlog).
- Sort and density controls in the same bar: PASS. Density is desktop-only; the mobile bar in 29a has no density control.
- Lint, build and test pass (145 tests, 5 new).

## Issues found in validate
- None blocking. Checked the remaining users of the changed modules (Dashboard, Settings, Accounts, SearchPalette, useCreditCardNotifications all read `usePreferences`). The new key is additive, `dense` is optional, and `groupByDay`'s new argument has a default.

## Pattern
- To stack sticky elements (a bar plus section headers) without hard-coded heights, measure the upper one with a ResizeObserver and publish its height as a CSS variable on a shared ancestor. The lower one reads `top: var(--…)`. This survives wrapping and the mobile/desktop switch. Put `sticky` on the wrapper whose parent spans the list, not on a node nested inside another sticky wrapper.

## Backlog
- Not verified live: the test account has no transactions, and seeding it would permanently change it (same call as LED-52/54/56/60). The bar's look under the top bar, the headers stacking under it, and the accent line in dark mode are unconfirmed in a browser.
- "Export match" is drawn in 29a but not in the acceptance criteria, so it is not built.
- Amount sort was left out because it can't coexist with day groups. If it's wanted, it should force the flat view.
- `txDensity` persists per browser. If Compact is set at desktop width, the rows stay compact on mobile, where the density toggle is hidden.
- The sum uses `-` to match the rows and day headers; 29a uses `−` (U+2212). Same unification item as the LED-60 retro.
- epic-5 CSV status for LED-61 was not edited.
