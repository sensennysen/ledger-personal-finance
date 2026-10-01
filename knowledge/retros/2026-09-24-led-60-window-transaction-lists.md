# LED-60 · Window the transaction lists — retro (2026-09-24)

## What shipped
- `src/lib/transactionWindow.ts` (pure): `WINDOW_STEP` (60 desktop / 30 mobile), `signedAmount`, `groupByDay` (per-day count + per-currency net), `sliceGroups`, `nextRowCount`, `dayLabel` (Today / Yesterday).
- `src/hooks/useRenderWindow.ts`: grows the rendered count one step at a time when a sentinel comes within 600px of the viewport (IntersectionObserver, `root: null`, which accounts for clipping by the scrolling `<main>`).
- `src/components/transactions/TransactionDayList.tsx`: sticky day headers (`top: var(--tx-list-sticky-top, 0px)`, left for LED-61) and a `WindowFooter` showing "Rendering rows 1–60 of N · scroll to load" / "Rows 1–30 of N".
- Activity (flat + grouped) and Account detail both windowed. Select-all, bulk actions and the "Show N" counts still use the full filtered set.

## Acceptance
- A rendered window of 60 rows (desktop) and 30 (mobile) that loads on scroll: PASS (unit-tested slice sizes; the hook wires it up).
- Sticky date group headers with per-day item count and net: PASS. Partial days keep whole-day figures; Account detail nets are relative to the account.
- Scroll position survives a cycle change: PASS by construction. The cycle is not in the window's reset key, so stepping keeps the rendered count; the page does not remount (AppLayout keys on pathname). The ticket cites LED-94; this assumes it meant LED-95.
- 2,000 rows on one account stays responsive: PARTIAL. First paint drops from 2,000 rows to 60, and grouping plus slicing 2,000 rows takes about 0.12 ms per run in Node. Not measured in a browser (see Backlog).

## Issues found in validate
- [FIX NOW, fixed] The sentinel was a `useRef`, so after switching flat↔grouped (or leaving an empty state) with unchanged counts, the observer kept watching a detached node and loading stopped. Now a callback ref held in state, which the effect depends on.

## Pattern
- An IntersectionObserver target that can remount must be tracked with a callback ref held in state, not `useRef`: the effect has to re-run when the node changes, and a ref change does not trigger one.

## Backlog
- Not verified live with ~2,000 rows: the test account has no transactions, and seeding it would permanently change it (same call as the LED-52/54/56 retros). Scrolling performance, the sticky header look under the top bar, and the footer→load handoff are still unconfirmed in a real browser.
- Rows already rendered stay in the DOM. Scrolling to the end of 2,000 rows still mounts 2,000 `TransactionRow`s. If that proves slow, move to true virtualization with LED-99.
- The header net uses `-` to match the rows; design 29a uses `−` (U+2212). Unify when the rows get their LED-99 pass.
- Incoming cross-currency transfers are netted under `tx.currency` after multiplying by `exchange_rate`, which mirrors a questionable label choice in `TransactionRow`. Revisit together.
- `signedAmount` duplicates `TransactionRow`'s sign rules; `TransactionRow` could consume it in LED-99.
- The LED-60 ticket says LED-94 where it most likely means LED-95; the CSV was not edited.
