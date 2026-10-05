# Epic 22 — post-release backlog, build order

Tickets in `epic-22-post-release-backlog-tasks.csv`. Refer to a phase as **"epic 22 phase N"** (e.g. `/evaluate epic 22 phase 1`): evaluate every ticket in that phase, in the order listed, and load each ticket's row from the CSV.

## Where this comes from

Written 2026-10-05, after epics 8 to 21 shipped to `main` and production (https://ledger-personal.vercel.app). It collects everything the retro Backlogs still held, ranked by risk rather than by source. Each ticket's DESCRIPTION cites its retro.

- **Tickets:** 20 (LED-257 to LED-276). **Points:** 45.
- **Branch convention:** commit to `main`, one commit per LED-NN ticket, push when the owner says so (CI and the Vercel deploy run on push).
- **Migrations** (LED-257, LED-263 to LED-267, maybe LED-261) reach production before the client: release checklist B, `pnpm db:push:remote` only when the owner asks.
- **Legal wording** (LED-257 f, LED-258 c, LED-268) is approved by the owner before commit (OD-5).

## Phase 1 — Production risk and data correctness (P1)

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 1 | LED-257 | Saved templates belong to a user, in the database | 5 | The one privacy issue: a second user on the same browser sees the first user's templates. Pulled forward from decision C. |
| 2 | LED-258 | Errors reach the operator, not only the console | 3 | Without it, production failures are invisible. Needs a decision on the sink first. |
| 3 | LED-259 | CSP blocks a blob: worker | 2 | A console violation nobody traced; may be a silent failure in production. |
| 4 | LED-260 | A renamed recurring row does not post a back-dated duplicate | 3 | Quietly wrong data; run the read-only query on production first. |
| 5 | LED-261 | Splitting a posted recurring row does not post it again | 2 | Same family as LED-260. |
| 6 | LED-262 | An offline edit of a recurring row does not report a false conflict | 2 | Verify first; may be a no-op. |

## Phase 2 — Personal data in the database (decision C) (P2)

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 7 | LED-263 | Preferences live in the database | 3 | Largest of the moved groups; sets the pattern for the rest. |
| 8 | LED-264 | Which Home widgets show lives in the database | 2 | Order is already in `profiles`; visibility joins it. |
| 9 | LED-265 | The setup checklist state lives in the database | 2 | |
| 10 | LED-266 | Card reminders already shown live in the database | 2 | |
| 11 | LED-267 | 13th Month picks live in the database | 2 | New table. |
| 12 | LED-268 | Sign-out clears personal browser copies; the notice says "kept in your account" | 2 | Last: needs every group moved, and owner-approved wording. |

## Phase 3 — Feature gaps (P3)

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 13 | LED-270 | Import cannot make a plain transfer into a credit card | 2 | Check first; may only need the picker narrowed. |
| 14 | LED-272 | Pay now on an overdue loan bill dates the payment today | 1 | Small. |
| 15 | LED-271 | Overspending weekly and quarterly rows drop the "1st" streak | 2 | |
| 16 | LED-269 | Card and loan payments, and imported transfers, between two currencies | 5 | Only matters with cross-currency card or loan payers; production had no cross-currency transfers (LED-254). |

## Phase 4 — Polish (P4)

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 17 | LED-273 | Screen-reader leftovers | 2 | From the LED-179 tree pass. |
| 18 | LED-275 | Skeleton loading bars are visible in light mode | 1 | Tokens only. |
| 19 | LED-274 | Home detail pane and account side column match the design widths | 1 | Measure first. |
| 20 | LED-276 | Link preview image in the current brand | 1 | Needs a design decision. |

## Decided, not tickets

Kept as they are by owner decision: the phone fold fits for typical data (LED-145, A), Accounts and Home keep their own overdue-row shapes (LED-173, B), the phone add button hides while scrolling down (D), the Activity Sum includes scheduled rows and says so (LED-251), confirm dialogs open on Cancel and no VoiceOver run is required (LED-179). See `knowledge/retros/2026-10-05-decisions-fold-overdue-fab.md` and `2026-10-05-led-179-a11y-tree-pass.md`.
