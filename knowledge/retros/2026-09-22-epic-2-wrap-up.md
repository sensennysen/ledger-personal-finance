# Epic 2 — Navigation shell wrap-up (LED-30 to LED-34)

## Outcome
All five tickets are implemented and marked Done in `epic-2-navigation-shell-tasks.csv`. `pnpm lint`, `pnpm build` and `pnpm test` (102 tests) pass on `redesign-m3`. A headless-Chrome pass against local Supabase (empty test account) followed; see Browser check.

## Commits
- LED-30: `7b7d5c2`, `3f21fbf`, `25b8efc`, `9079344`, `f660a9d`
- LED-32: `bad37e2`
- LED-34, LED-33, LED-31: one commit each, in that order, after LED-32.

## Browser check (headless Chrome, local Supabase, empty account)
Six routes at 1920 / 1280 / 1024 / 768 / 390. Verified:
- No horizontal overflow, no console errors, header present and no skeleton in it at any size.
- Six tabs including `/categories` at every size; bottom nav keeps four at 390.
- At 390 the active tab scrolls into view (Reports, Categories); theme toggle works from row 1.
- 13th Month at 1920 has no width cap, with the summary column beside the records card. Reports at 1024 lays out cleanly.

## Follow-up fixes (after the first browser pass)
- 13th Month page `<h1>` is `md:hidden`; row 2 carries the title. `/accounts/:id` row 2 renders its title as a `<p>` (`titleIsHeading: false`), so the account name is the single `<h1>`.
- Removed the `⌘K` hint from the disabled search until LED-40.
- `undo-toast` moved to `184px + safe-area` above the FAB and install banner (was `bottom-18`, overlapping the bottom nav).
- FAB: with the 88px padding, the FAB covered the last row's trailing controls at scroll end (seen on Activity and Accounts with seeded data). The FAB now fades out and stops taking pointer events within 80px of scroll end (`src/lib/scrollEnd.ts`) and returns on scroll up. Pages that do not scroll keep it. Chosen over restoring the 176px spacer.
- Tests: `layoutGeometry.test.mjs` (source-level: main padding = bottom nav height; FAB/toast/banner clear the nav), `scrollEnd.test.mjs`, `pageChrome.test.mjs`.

## Second browser pass (headless Chrome, 9 seeded accounts, 54 transactions)
- Accounts 1920, Reports 1920 and 13th Month 1920/1440: no overflow; 13th Month has one heading and its DOM order equals the visual order (the summary column has no focusable elements).
- Under throttled network (800ms latency, 60KB/s) the header and all tabs render at the first sample with no skeletons.
- FAB at 390: visible at top and mid-scroll, hidden at scroll end, back after scrolling up (Activity, Accounts); Budgets does not scroll so it stays.

## Backlog
- Real iOS safe-area insets are unverified; headless Chrome reports 0.
- Tablet tab overflow (icon-only tabs at md-lg) has no design frame; it is an interpretation.
- Seed data was one month of simple transactions: Reports charts and Accounts at 2xl (4 columns) were checked for overflow only, not for visual polish.

## Hand-offs
- LED-40: search field is a disabled placeholder, no Cmd+K listener.
- LED-100: dark token pair audit is unblocked by LED-32. "System" theme option is out of scope.
- Categories, Transactions and AccountTransactions keep `max-w-3xl`; not in LED-33's scope.
