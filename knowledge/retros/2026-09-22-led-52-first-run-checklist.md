# LED-52 — First-run checklist

## Pattern
`month_start_day` defaults to `1` in the DB, which is indistinguishable from a user deliberately keeping the 1st — so step 3 ("Set your pay cycle") can't be read off `startDay` directly. Added an explicit `cycleConfirmed` flag (`src/hooks/useFirstRunChecklist.ts`, same localStorage-singleton shape as `usePreferences.ts`), flipped only when the user actually touches the Month Cycle selector (`SettingsPage.tsx`'s `onValueChange`). Steps 1–2 stay derived live from `accounts.length`/`transactions.length` — no persistence needed there, they're naturally true once data exists.

## Decisions
- Lock state is a single `setupComplete` boolean (all 3 steps done), not per-step partial unlocking — matches the mockup's copy ("Three steps and the rest of the app switches on") and keeps `navDestinations.ts`'s `isLocked` a pure, cheaply testable function.
- `AppLayout.tsx`'s `LayoutShell` adds its own `useAccounts()` call rather than threading data down from `DashboardPage` — it already calls `useTransactions()` independently for the same reason (both hooks cache per-user via `readCache`/`writeCache`, so this follows the existing pattern rather than introducing prop-drilling across the route tree).
- Checklist step actions reuse existing entry points (`navigate('/accounts')`, the existing `openAddTransactionModal`, `navigate('/settings')`) instead of new dialogs — no new UI surface beyond the checklist card itself.

## Acceptance
- Three ordered steps, account → transaction → cycle: PASS. Verified live (screenshot) and via `tests/firstRunChecklist.test.mjs`.
- Skippable: PASS. Verified live — "skip setup" hides the card.
- Persists until complete: PASS. Verified live — reloaded after skipping, card stayed hidden (localStorage `ledger-first-run`).
- Lock glyph on Activity/Budgets/Categories/Reports, not opacity: PASS. Verified live (zoomed screenshot) — icon swaps to `Lock`, no opacity change.
- Advisory only, never blocks: PASS. Verified live — clicked the locked "Activity" tab, it navigated and rendered normally.
- `pnpm exec tsc -b`, `pnpm lint`, `pnpm build`, `pnpm test` (133/133, +7 new): PASS.

## Backlog
- The full 0/3 → 3/3 transition (checklist disappears, nav locks lift together) wasn't exercised live end-to-end — the test account has zero accounts/transactions, and adding real ones just to watch the transition would permanently mutate it (same call LED-54's retro made). Covered instead by `isSetupComplete`'s unit tests; low risk since it's the same boolean gating both the card and `isLocked`.
- `BottomNav.tsx`'s lock-glyph rendering (mobile, <768px) wasn't visually confirmed — `resize_window` didn't actually shrink the viewport in this environment (stayed at 1280px regardless of the requested size). Verified by code parity only: identical `isLocked`/icon-swap call as the already-verified `TopBar.tsx`.
- The 768px tablet frame from mockup #20a wasn't checked as a distinct breakpoint — Tailwind's `md:` activates at 768px inclusive, so it's the same desktop `TopBar` code path already verified, not a separate implementation.
