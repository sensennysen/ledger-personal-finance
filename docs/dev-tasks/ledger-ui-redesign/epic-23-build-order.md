# Epic 23 — post-release follow-ups, build order

Tickets in `epic-23-post-release-followups-tasks.csv`. Refer to a phase as **"epic 23 phase N"** (e.g. `/evaluate epic 23 phase 1`): evaluate every ticket in that phase, in the order listed, and load each ticket's row from the CSV.

## Where this comes from

Written 2026-10-06, after epic 22 (PR #13) merged to `main`, its nine migrations reached the hosted database and the production deploy went live. It collects what the four epic 22 phase retros (`knowledge/retros/2026-10-06-epic-22-phase-{1..4}.md`) left in their Backlogs, ranked by risk. Each ticket's DESCRIPTION cites its retro.

- **Tickets:** 15 (LED-277 to LED-291). **Points:** 23.
- **Branch convention:** one branch, `epic-23`, one commit per LED-NN ticket. Push and open the pull request when the owner says so; CI runs on the pull request, the Vercel production deploy on the merge to `main`.
- **Migrations** (maybe LED-277, maybe LED-279) reach production before the client: release checklist B, `pnpm db:push:remote` only when the owner asks.
- **Owner decisions** in `/plan`: LED-277 (what a split does to the series) and LED-279 (report signed-out errors or not).

## Phase 1 — Data correctness and decisions (P1)

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 1 | LED-277 | Splitting the latest row of a recurring series keeps the schedule | 2 | Ends a series silently. Needs a decision. |
| 2 | LED-278 | A setting changed offline survives a reload | 2 | A change the user made is lost. |
| 3 | LED-279 | Errors on signed-out pages reach the operator | 3 | A broken sign-in is invisible today. Needs a decision; option A is a security trade-off. |
| 4 | LED-280 | Live checks for payments between two currencies | 2 | Verification only. Run before phase 2: a FAIL may reorder it. |

## Phase 2 — Currency and import gaps (P2)

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 5 | LED-281 | The receiving account's list shows the payment's own currency | 2 | Wrong label on a money amount. |
| 6 | LED-282 | Activity Sum and Month jump skip the empty currency bucket of a transfer | 2 | Same LED-269 family. |
| 7 | LED-283 | Import says why it is blocked | 1 | |
| 8 | LED-284 | Overspending past cycles name their window | 1 | |

## Phase 3 — Polish (P3)

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 9 | LED-285 | A failed template upload says the save failed | 1 | Copy. |
| 10 | LED-286 | The Account page search has a name | 1 | LED-273 leftover. |
| 11 | LED-287 | The account picker names its first option when it opens | 2 | LED-273 leftover; needs its own trace. |
| 12 | LED-288 | Skeleton bars are visible on the grey page | 1 | Tokens only. |
| 13 | LED-289 | The Account side column follows the design width, or the cap stays | 1 | Measure first. |
| 14 | LED-290 | Trace the 400 on the dev login page | 1 | |
| 15 | LED-291 | Remove or redraw `public/favicon.svg` | 1 | |

## Owner checks after the epic 22 merge (not tickets)

- LED-258 (b): a forced error on production shows as a row in `error_events`.
- LED-259 C5: the signed-in production console is clean on Home, Activity, Reports and Import.

LED-276 (c) passed on 2026-10-06: production serves the new `/social-preview.png`, and `og:image` and `twitter:image` point to it.

## Decided, not tickets

- The first device to sign in after the epic 22 deploy decides whether a browser's old templates, preferences, layout or checklist upload (LED-257, LED-263 to LED-265).
- From-empty migration replay runs in CI's `db` job only; `pnpm db:reset` would wipe the owner's local data.
- Legal wording for LED-257 and LED-258 approved by the owner (2026-10-06).
