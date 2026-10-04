# Epic 19 · LED-213 — release checklist: live CI run and remote migrations — retro (2026-10-04)

Branch `epics-15-19`. One 2-point hygiene ticket in phase 6, commit `3073ef0`. The phase 13, LED-134, LED-136 and LED-232 retros each said a step could not be verified locally: the live CI run, the migrations on the hosted database, the CSP header Vercel serves. No code. Nothing was run against the linked remote.

## What was done
| Change | Detail |
|---|---|
| `knowledge/checklists/release.md` | A. the CI run log; B. `migration list --linked`, `db:push:remote`, list again, then deploy, and a table of the 16 migrations absent from `origin/main` with what fails without each; C. the live CSP header against `vercel.json`; D. a smoke test on the live site, one row per risky migration. |
| `README.md` | "Upgrading a self-hosted database": apply in filename order before deploying the client; a missing column the client writes rejects every transaction save. The CI section points to the checklist for what CI cannot see. |
| `knowledge/README.md`, build order | Checklist index entry; LED-213 line under phase 6. |

Each "if it is missing" cell was traced to the client file that reads or writes the object (e.g. `useImportDuplicates.ts:37` selects `destination_amount, original_amount`; `useTransactions.ts:403` filters on `recurrence_next_posted`; `useCardPayment.ts:55` inserts `transaction_id`; `SettingsPage.tsx:177` updates `budget_deficit_behaviour`). Three first drafts were wrong and were corrected before the commit: the account form writes `loan_due_days`, not `loan_due_day`, and categories are read with `select('*')`, so only the save fails.

## Acceptance
| Criterion | Result |
|---|---|
| (a) The checklist lives in `knowledge/` and README | PASS. `knowledge/checklists/release.md`; README links it twice. |
| (b) Each migration is listed with what fails if it is missing | PASS. 16 rows, `20260920100000` to `20261004120000`. One row (`20260920100000`) says honestly that no client use was found. |
| (c) The CI run is recorded with its link | PARTIAL. Run 36568023009 (PR #9, 2026-09-29) is recorded, but it predates every listed migration. The `epics-15-19` → `main` PR is not open yet. |
| (d) Nothing is pushed to the remote by this ticket | PASS. No `db:push:remote`, no `--linked` command. (The git branch was pushed on request; that is not the database.) |

Lint, build and 1001 tests pass. Graphify puts the checklist in its own community; no code crossings.

## Backlog
- (c): record the `epics-15-19` PR's CI link in the checklist's run log, then set LED-212 and LED-213 to Done.
- Which migrations the hosted database already has is unknown (`supabase migration list --linked` was not run).
- The two `20260920*` files capture objects "prod already has", per their headers; not confirmed against prod.
- Merging to `main` deploys on Vercel. The migrations must reach the hosted database first (checklist B), or every transaction write fails on `destination_amount`.
- `supabase/schema.sql` has none of the 16 migrations' objects, so README's "run schema.sql, then migrations" means all 16 for a new self-hoster.
