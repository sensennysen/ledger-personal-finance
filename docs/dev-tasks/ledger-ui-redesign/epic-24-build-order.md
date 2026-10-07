# Epic 24 — code review findings, build order

Tickets in `epic-24-code-review-findings-tasks.csv`. Refer to a phase as **"epic 24 phase N"** (e.g. `/evaluate epic 24 phase 1`): evaluate every ticket in that phase, in the order listed, and load each ticket's row from the CSV.

## Where this comes from

Written 2026-10-06 from the code review of commit 776b69be (`docs/reviews/code-review-2026-10-06.csv` and `.md`, retro `knowledge/retros/code-review-2026-10-06.md`). One ticket per finding, numbered in finding order: **LED-(293+n) is REV-00n**. Each row's DESCRIPTION carries the finding's evidence, impact, source locations and suggested fix; its ACCEPTANCE_CRITERIA start with the review's verification step.

- **Tickets:** 28 (LED-294 to LED-321). **Points:** 66.
- **Branch convention:** one branch, `epic-24`, one commit per LED-NN ticket. Push and open the pull request when the owner says so; CI runs on the pull request, the Vercel production deploy on the merge to `main`.
- **Migrations** (LED-294, LED-296, LED-312, LED-314, LED-315, LED-316) reach production before the client: release checklist B, `pnpm db:push:remote` only when the owner asks.
- **Database checks:** until LED-319 lands, each migration ticket records an SQL check inside `begin ... rollback` (anon, owner and a second user) in its retro. LED-319 turns those into the CI suite.
- **Owner decisions** in `/plan`: LED-294 (invoker + RLS or a private schema), LED-299 (versioned queue items or locked editing), LED-303 (IndexedDB queue), LED-312 (increment RPC or ledger rows), LED-315 (clear or remap the subcategory), LED-316 (block or convert the currency), LED-321 (in-repo query store or a library).

## Phase 1 — Tenant isolation and atomic money (P1)

| # | Ticket | Finding | Summary | Pts | Why here |
|---|---|---|---|---|---|
| 1 | LED-294 | REV-001 | Loan calculations answer only for the owner of the purchase | 3 | Discloses another user's amounts. Needs a decision. |
| 2 | LED-295 | REV-002 | A profile read from a previous session never reappears after sign-out | 2 | Privacy across sign-out. |
| 3 | LED-296 | REV-003 | Card payment tracking is recorded once and atomically | 3 | Lost or doubled statement payments. |

## Phase 2 — Offline write protection (P1/P2)

| # | Ticket | Finding | Summary | Pts | Why here |
|---|---|---|---|---|---|
| 4 | LED-297 | REV-004 | A queued edit never silently overwrites a newer server edit | 3 | Lost updates. Adds the revision LED-299 builds on. |
| 5 | LED-298 | REV-005 | Imported offline transactions keep their IDs through sync | 2 | Duplicate inserts, edits aimed at missing rows. |
| 6 | LED-299 | REV-006 | An edit made while a queued insert is saving is not lost | 2 | Needs a decision. |
| 7 | LED-301 | REV-008 | A receipt uploaded before a failed save stays attached | 2 | Before LED-300: it persists the resolved path. |
| 8 | LED-300 | REV-007 | A receipt attached offline or after a failed upload still uploads | 3 | |

## Phase 3 — Durable, shared queue (P2)

| # | Ticket | Finding | Summary | Pts | Why here |
|---|---|---|---|---|---|
| 9 | LED-303 | REV-010 | An offline save shows success only once it is stored | 3 | Moves the queue to IndexedDB. Needs a decision. |
| 10 | LED-302 | REV-009 | Two open tabs share one queue without losing or doubling writes | 3 | Builds on LED-303. |
| 11 | LED-318 | REV-025 | A large offline import is stored in one write | 2 | Builds on LED-303 and LED-298. |
| 12 | LED-305 | REV-012 | Pending transactions sync when the app opens online | 2 | After LED-302, so two tabs do not both drain on start. |

## Phase 4 — Money correctness and integrity (P2)

| # | Ticket | Finding | Summary | Pts | Why here |
|---|---|---|---|---|---|
| 13 | LED-313 | REV-020 | A failed contribution keeps the dialog open and says why | 1 | Smallest; same screen as LED-312. |
| 14 | LED-312 | REV-019 | Concurrent savings contributions are all counted | 2 | Needs a decision. |
| 15 | LED-310 | REV-017 | The cash-flow forecast converts each amount to the base currency | 2 | |
| 16 | LED-311 | REV-018 | Savings-goal contributions convert to the goal currency | 2 | |
| 17 | LED-314 | REV-021 | Every user-owned reference is checked for ownership | 3 | Repair existing links first. |
| 18 | LED-315 | REV-022 | Changing category never leaves a subcategory from another category | 2 | Needs a decision. |
| 19 | LED-316 | REV-023 | An account with history cannot silently change currency | 2 | Needs a decision. |
| 20 | LED-308 | REV-015 | History and export reads include every row past 1000 | 2 | |
| 21 | LED-309 | REV-016 | The account export includes archived accounts | 1 | |

## Phase 5 — Read and cache lifecycle (P2/P3)

Batched after the write work, as the review recommends.

| # | Ticket | Finding | Summary | Pts | Why here |
|---|---|---|---|---|---|
| 22 | LED-321 | REV-028 | Entity reads share one request, cache and error policy | 3 | Foundation for the three below. Needs a decision. |
| 23 | LED-304 | REV-011 | Changing filters quickly shows only the latest results | 2 | |
| 24 | LED-307 | REV-014 | A list opened offline without a copy says so instead of loading forever | 2 | |
| 25 | LED-306 | REV-013 | Every mounted list and total refreshes after a change | 3 | |

## Phase 6 — Verification, types and performance (P2/P3)

| # | Ticket | Finding | Summary | Pts | Why here |
|---|---|---|---|---|---|
| 26 | LED-319 | REV-026 | CI runs database tests for tenant isolation and concurrent money writes | 3 | Collects the SQL checks from phases 1 and 4. |
| 27 | LED-320 | REV-027 | The Supabase client is typed from the database schema | 3 | |
| 28 | LED-317 | REV-024 | Pages and heavy features load when they are needed | 3 | Measure before and after. |

## Not tickets (from the review's Backlog)

- Check deployed function grants on the hosted database with anon and two seeded users after LED-294 reaches production.
- Check dependency advisories separately; the review made no package vulnerability claim.
