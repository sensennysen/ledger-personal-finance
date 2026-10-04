# Epics 15 to 19 — build order

Phases for `epic-15-currency-correctness-tasks.csv`, `epic-16-payment-correctness-tasks.csv`, `epic-17-auth-offline-small-gaps-tasks.csv`, `epic-18-unverified-passes-tasks.csv` and `epic-19-hygiene-and-docs-tasks.csv`. Refer to a phase as **"epics 15-19 phase N"** (e.g. `/evaluate epics 15-19 phase 1`): evaluate every ticket in that phase, in the order listed, and load each ticket's row from its CSV.

## Where these epics come from

After epics 8 to 13 (phases 1 to 13) and the epic 14 live-sweep findings were written, the retro Backlogs still held items that no ticket owned. This file collects them. Each row cites its retro; the `Parked` table in `epics-8-13-build-order.md` is now held by LED-214.

- **Tickets:** 33 (LED-182 to LED-214). **Points:** 108. Epic 15 = 32 pts (8 tickets), epic 16 = 22 (6), epic 17 = 22 (9), epic 18 = 18 (5), epic 19 = 14 (5).
- **Branch convention:** one branch per phase, `epics-15-19-phase-N`, one commit per LED-NN ticket, as before.
- **Epic 14 is separate.** Its phases keep their own order (`epic-14-build-order.md`). Where an item here depends on an epic 14 ticket, the phase notes say so.
- **Every item was re-checked against the tree** when these rows were written (2026-09-27): `sumTransactionsByType` still adds native amounts, `signInWithGoogle` still ignores its result, recurring generation still does not touch `credit_card_payments`, and `kindMenu.ts:111` still says "Posts as an expense against the card".

## Phase 1 — Trust the numbers

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 1 | LED-182 | One converted-totals helper for income and expense | 8 | Pure `src/lib` code; every other ticket in the phase calls it. |
| 2 | LED-183 | Category breakdown, Reports flows and Top categories use it | 5 | Removes the mixed-currency sums that disagree with Budgets. |
| 3 | LED-184 | Net worth over time walks back in the default currency | 5 | Same helper; the chart must end at today's net worth. |
| 4 | LED-186 | Deletion export budgets get their converted spend | 3 | Reuses the converter. Wording of the export stays with LED-180. |
| 5 | LED-187 | Settings rate status | 1 | Label only. |

## Phase 2 — Payment correctness

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 6 | LED-190 | Recurring transfers to a card run the statement steps | 5 | Decide the card path first; LED-191 builds on it. |
| 7 | LED-191 | Editing or deleting a card payment keeps the statement in step | 8 | Balances change; check the triggers on a local database. |
| 8 | LED-192 | Payment history refreshes after a global-modal payment | 2 | Same page as LED-191. |
| 9 | LED-193 | Fixing a queued card payment offline | 3 | Uses the payload shape LED-190 and 191 settle. |
| 10 | LED-194 | Card dialog subtitle and category counts | 2 | Copy and a re-read of two counts. |
| 11 | LED-195 | Pay now for a past loan bill defaults to today | 2 | Independent; loan path, not the card path. |

## Phase 3 — Auth, offline and small gaps

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 12 | LED-196 | Google sign-in shows the error | 2 | AGENTS.md rule; small. Do first. |
| 13 | LED-197 | The offline add form picks an account from the cache | 3 | Independent. |
| 14 | LED-198 | Undo for deleting a saved filter | 2 | Independent. |
| 15 | LED-199 | The first-run checklist reserves its space | 3 | After epic 14 LED-158, which edits the same component. |
| 16 | LED-200 | Skeleton leftovers | 3 | Measure after LED-199 so the numbers are not stale. |
| 17 | LED-201 | No dark frame on load for a System user | 3 | Touches `index.html`; keep the CSP strings identical. |
| 18 | LED-203 | Home ranked card against the pie card | 2 | Layout only; measure at 1920. |
| 19 | LED-204 | Net worth chart x labels at 390 | 1 | After epic 14 LED-174, which adds the tick helper. |

## Phase 4 — Verification (run after phases 1 to 3, and after epic 14 phase 1)

| # | Ticket | Summary | Pts | Notes |
|---|---|---|---|---|
| 20 | LED-188 | Live checks for the exchange-rate feed | 3 | Needs phase 1, so the totals are the converted ones. |
| 21 | LED-205 | Dark theme sweep | 5 | Run after LED-201. |
| 22 | LED-206 | Tablet width sweep | 3 | Two-currency filter needs LED-183. |
| 23 | LED-207 | Rendered contrast scan on four more screens | 3 | Both themes. |
| 24 | LED-208 | Phone sheet fields, loan and card edits, offline saves per kind | 5 | Needs LED-191 for card edits. |
| 25 | LED-209 | Card page at 1024 and the docked pane width | 2 | Small. |

**Phase 4 findings.** Each FAIL in the phase 4 sweep retros is a ticket in `epic-20-phase-4-sweep-findings-tasks.csv`, numbered from LED-224:

| Ticket | Found by | Summary |
|---|---|---|
| LED-224 | LED-188 | Home Expenses by Category does not name the currencies it leaves out |
| LED-225 | LED-188 | Re-importing a converted statement at another rate re-imports its transfer rows |
| LED-226 | LED-206 | Import dialog has no side gutter from 640 to 799px |
| LED-227 | LED-206 | Top categories: "Other, 1 categories" for a single remaining category |
| LED-228 | LED-207 | Inactive tab labels are 3.55:1 in the light theme |
| LED-229 | LED-207 | Saved filter rows show focus only with a half-opacity ring (2.07:1) |
| LED-230 | LED-208 | Editing a row into a transfer to a card records no card payment |
| LED-231 | LED-209 | Card account page at 1024: the list column is squeezed to 344px |
| LED-232 | epic 20 validation | Recurring rows are posted again by every browser that has not posted them |

## Phase 5 — Decision-gated (answered 2026-10-03)

All five questions are answered (see the Decision register). Phase 5 is done (2026-10-03, retro `knowledge/retros/2026-10-03-epics-15-19-phase-5.md`): LED-185, LED-189, LED-202 and LED-211 are `Done`, and LED-214 is `Done`. LED-202's decision was revised after measuring (see its row), and LED-211's first run filed LED-246 in epic 21.

| # | Ticket | Summary | Pts | Decision |
|---|---|---|---|---|
| 26 | LED-185 | Second rate for cross-currency transfers, Overspending totals | 5 | OD-10 (a): store the destination amount on the transfer |
| 27 | LED-189 | Legal pages: Privacy Policy, Terms, data deletion, cookies and storage, other notices | 5 | OD-9, widened: every page drafted; you approve each before it is committed |
| 28 | LED-202 | First four widgets above the fold at 390 | 3 | OD-11 (a): a shorter cash flow chart on phones; revised 2026-10-03 after measuring (the chart is not in the default first four): compact the first four on phones as in 18a, and keep the shorter chart |
| 29 | LED-211 | Sweep drivers as a repo script | 5 | OD-12 (a): a dev-only script |
| 30 | LED-214 | Parked items that need a call (bundle) | 3 | OD-13: answered per item; tickets in epic 21 below |

**Epic 21 — from OD-13 and OD-9** (`epic-21-phase-5-decisions-tasks.csv`). Item 7 (deficit panel without rollover) is closed as is.

Built in four phases (plan 2026-10-03), each validated before the next:
- **A, quick and independent:** LED-246, 244, 234, 235, 243. **Done** (2026-10-03, retro `knowledge/retros/2026-10-03-epic-21-phase-a.md`).
- **B, categories:** LED-233, then 236, 240, 239. **Done** (2026-10-04, retro `knowledge/retros/2026-10-04-epic-21-phase-b.md`).
- **C, cycle totals:** LED-238, then 237. **Done** (2026-10-04, retro `knowledge/retros/2026-10-04-epic-21-phase-c.md`). Validation filed LED-251.
- **D, Activity, loading, storage:** LED-241, 242, 245. **Done** except LED-245 (d), the link from the cookie notice, which waits for wording approval (2026-10-04, retro `knowledge/retros/2026-10-04-epic-21-phase-d.md`).

| Ticket | Item | Summary | Pts |
|---|---|---|---|
| LED-233 | 1 | Category names are unique within their parent (case-insensitive; same subcategory name under different parents allowed) | 3 |
| LED-234 | 2 | Import flags identical rows within one file, both stay ticked | 2 |
| LED-235 | 3 | Savings goals show on track or behind by (straight-line pace) | 3 |
| LED-236 | 4 | A category can count as salary | 3 |
| LED-237 | 5 | Previous-period comparisons are like for like | 3 |
| LED-238 | 6 | Future-dated rows count from their date | 5 |
| LED-239 | 8 | Merge categories (after LED-233) | 5 |
| LED-240 | 8 | One Reorder control on Categories | 3 |
| LED-241 | 9 | Sort Activity by amount, flat while sorted | 3 |
| LED-242 | 10 | A failed page load shows its error in about 2 s | 2 |
| LED-243 | 11 | Each Home widget has its own error boundary | 3 |
| LED-244 | 12 | A yearly budget in Overspending is labelled year to date | 1 |
| LED-245 | OD-9 | Cookie and browser storage settings (after LED-189's wording) | 3 |
| LED-246 | LED-211 | Hover tints drop two text colours below 4.5:1 in the light theme (found by the sweep script's first run) | 1 |
| LED-247 | LED-246 | Settings shows garbled characters in the currency list and the delete button (found in passing) | 1 |
| LED-248 | LED-246 | Hovered primary and destructive buttons drop their label below 4.5:1 (found by `pnpm sweep --hover`) | 1 |
| LED-249 | LED-235 | A completed goal card dims its text below 4.5:1 (found with a completed goal on the local stack) | 1 |
| LED-250 | phase B validation | The auto-categorization rule form shows a category id once one is chosen (LED-239 fixed the same in its merge dialog) | 1 |
| LED-251 | phase C validation | Account balances and net worth move when a future-dated row is saved, not on its date (needs a decision first) | 5 |

## Phase 6 — Hygiene (run last, so statuses reflect what shipped)

| # | Ticket | Summary | Pts | Notes |
|---|---|---|---|---|
| 31 | LED-210 | Flip CSV statuses for epics 8 to 13 | 2 | LED-121 rule; use the round-trip pattern. |
| 32 | LED-212 | Merge route for the phase branches, `.claude/launch.json` | 2 | Do not push or merge without being asked. |
| 33 | LED-213 | Release checklist: live CI and remote migrations | 2 | The remote step only when the owner asks. |

Phase totals in points: 1 = 22, 2 = 22, 3 = 19, 4 = 21, 5 = 21 (LED-189 widened from 2 to 5), 6 = 6. Sum 111. Epic 21 adds 48 (39, plus LED-247 to 249 filed during phase A, LED-250 during phase B and LED-251 during phase C).

## Decision register

| ID | Question | Options | Recommendation | Blocks | Answer (2026-10-03) |
|---|---|---|---|---|---|
| OD-9 | What does the Privacy Policy say about `api.frankfurter.dev`? | Wording approved by you, or the developer's draft (currency codes and the visitor's IP go to the host) | You approve the wording before it is committed (legal text, as OD-5) | LED-189 | Widened: write up the Privacy Policy, Terms, data deletion instructions, a cookie and storage notice with settings (LED-245), and the other legal notices; you approve each page's wording before it is committed |
| OD-10 | How does a cross-currency transfer carry its second value? | (a) store the destination amount on the transfer (migration); (b) store a rate on the transfer; (c) leave one amount and label Overspending per currency | (a) | LED-185 | (a) |
| OD-11 | What does "first four widgets above the fold" mean at 390? | (a) a shorter cash flow chart on phones; (b) fewer widgets above it; (c) drop the claim | (a) | LED-202 | (a) |
| OD-12 | Should the sweep drivers live in the repo? | (a) yes, a dev-only script; (b) no, keep the pattern file | (a) | LED-211 | (a), dev only |
| OD-13 | The twelve parked items in LED-214 | per item, each with a Fallback in the ticket | answer them in one pass; most stay as the Fallback | LED-214 | Item 7 kept as is; the other eleven changed (LED-233 to LED-244) |

Decisions inside a ticket (not blocking): LED-195 (Pay now for a past bill defaults to today; recommended).

## Things to watch

- **LED-182 and LED-183 consume the shared transaction read that epic 14's LED-166 rewrites.** Do LED-166 first, or re-run its network-log check after phase 1. Totals must still equal SQL past 1,000 rows (`rules/page-reads-past-1000-rows.md`).
- **Every converted total follows `rules/foreign-currency-rate-of-one-is-not-a-rate.md`:** no rate means left out and named, never 1.
- **`useTransactions` is a high-degree node.** LED-182, 183 and 190 touch it or its callers; keep each diff to its own concern.
- **LED-190 and LED-191 change what is written.** Confirm on a local database that the account-balance triggers still net correctly (`rules/card-payment-is-a-transfer.md`, `patterns/atomic-write-as-an-invoker-function.md`).
- **Migrations (LED-185, and LED-191 if it needs one)** must apply cleanly to an empty database and pass the CI `db` job. Never run `pnpm db:push:remote`.
- **LED-201 must not change the CSP.** A first-party script file is allowed by `script-src 'self'`; do not add `unsafe-inline`.
- **Legal text (LED-189, and epic 13's LED-142)** is committed only after you approve the wording.
- **Verification tickets record PASS, FAIL or not checkable.** A FAIL becomes a new LED ticket; do not fix inside the sweep.
- **Not in these epics:** the real-device and screen-reader passes (LED-178, LED-179) and the two decisions LED-180 and LED-181 stay in epic 14; LED-142 stays in epic 13.

## Finding to ticket map

| Backlog item | Where recorded | Ticket |
|---|---|---|
| Income, expense and category totals are mixed-currency | LED-136 retro | LED-182, 183 |
| Net worth over time mixes currencies | LED-136 retro | LED-184 |
| Cross-currency transfers, Overspending "A + B" | LED-136 retro | LED-185 |
| Deletion export budgets: no rates, inactive budgets | LED-136, LED-143 retros | LED-186 |
| Settings "Rates · fetched" with nothing requested | LED-136 retro | LED-187 |
| Refresh modes, queue with `original_amount`, transfer import: not run | LED-136 retro | LED-188 |
| Privacy Policy and the exchange-rate host | LED-136 retro | LED-189 |
| Recurring transfers to a card skip the statement | LED-146 retro | LED-190 |
| Edit or delete of a card payment leaves the statement | LED-146, phase 10 retros | LED-191 |
| Payment history stale after a global-modal payment | LED-146 retro | LED-192 |
| Fix on a queued payment needs a connection | LED-146 retro | LED-193 |
| Card dialog subtitle; category counts for card payments | LED-114, phase 13 retros | LED-194 |
| Pay now for a past loan bill dates on the old due date | LED-145 retro | LED-195 |
| `signInWithGoogle` ignores its error | LED-144, phase 10 retros | LED-196 |
| Offline add form has no account until the cache loads | LED-145, phase 10 retros | LED-197 |
| Deleting a saved filter has no Undo | LED-138 retro | LED-198 |
| First-run checklist shifts Home 362px | LED-150, phase 11 retros | LED-199 |
| Skeletons not measured or not reserved | LED-150 retro | LED-200 |
| One dark frame on load for a System user | LED-151, phase 11 retros | LED-201 |
| First four widgets above the fold at 390 | LED-145, phase 10 retros | LED-202 |
| Ranked card taller than the pie card | LED-149 retro | LED-203 |
| Net worth chart x labels at 390 | live sweep, lists and reports | LED-204 |
| Dark theme not viewed on most screens | the three sweeps | LED-205 |
| Tablet width not seen | LED-149 retro, lists sweep | LED-206 |
| Contrast scan not run on four screens | LED-144, 151 retros, phases 10 and 11 | LED-207 |
| Phone sheet fields, loan and card edits, offline saves per kind | transaction-kinds sweep | LED-208 |
| Card page at 1024; docked pane 340 vs 380 | accounts sweep | LED-209 |
| CSV statuses not flipped | phase 10, 11 and 13 retros | LED-210 |
| Sweep drivers not committed | phase 12 retro | LED-211 |
| Unmerged phase branches; `.claude/launch.json` untracked | every retro | LED-212 |
| No live CI run; migrations not applied to the remote | phase 13, LED-134, LED-136 retros | LED-213 |
| Parked items | `epics-8-13-build-order.md`, lists sweep | LED-214 |
