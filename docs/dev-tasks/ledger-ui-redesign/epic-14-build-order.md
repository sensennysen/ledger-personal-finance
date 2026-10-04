# Epic 14 — live sweep findings: build order

Phases for `epic-14-live-sweep-findings-tasks.csv`. Refer to a phase as **"epic 14 phase N"** (e.g. `/evaluate epic 14 phase 1`): evaluate every ticket in that phase, in the order listed, and load each ticket's row from the CSV.

## Where this epic comes from

On 2026-09-26 the four phase 12 sweeps (LED-124 to LED-127) ran the finished tree in a real browser against a local Supabase. They recorded **121 PASS, 24 FAIL and 10 not checkable**. Each FAIL is a ticket here (LED-154 to LED-177). Four more tickets hold the backlog that needs prioritising: a real-device pass (LED-178), a screen-reader pass (LED-179) and two decisions (LED-180, LED-181). The measurements are in `knowledge/retros/2026-09-26-live-sweep-*.md`; each row cites its retro.

- **Tickets:** 28 (LED-154 to LED-181). **Points:** 78. Priority: 6 High (19 pts), 12 Medium (43 pts), 10 Low (16 pts).
- **Branch convention:** one branch per phase, `epic-14-phase-N`, one commit per LED-NN ticket, as before.
- **Re-check after each fix:** re-run the sweep item named in the ticket's acceptance criteria. The sweep drivers were run from a scratchpad and are not in the repo; `knowledge/patterns/browser-check-with-local-user.md` and `live-sweep-method.md` say how to rebuild them.

## Phase 1 — Broken at a real size

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 1 | LED-154 | Top bar: theme toggle, Settings and account menu off-screen at 1024 to 1137px | 3 | A laptop at 1024 cannot reach Settings or sign out. Touches `TopBar.tsx`; fix before LED-155 and LED-157 edit the same file. |
| 2 | LED-168 | Reports Analytics: Income vs. Expenses chart is empty | 3 | The lookback selector on that tab does nothing. Small, isolated. |
| 3 | LED-170 | Import: "Import to" select shows the account id | 2 | Small, in `ImportCSVDialog.tsx`; do before LED-169 so the dialog is fixed in one pass. |
| 4 | LED-169 | Import dialog is 746px wide in a 343px dialog at 375 and 390 | 5 | Import cannot be used on a phone. Also unblocks the Category Select check LED-125 could not run. |
| 5 | LED-159 | Queue review sheet is unusable at 390 | 3 | The screen that protects offline edits cannot be read on a phone. |

## Phase 2 — Auth and data trust

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 6 | LED-162 | Sign-out failure message is false | 3 | Needs a small product answer on the behaviour (see the ticket). Auth copy that lies. |
| 7 | LED-172 | Accounts: Assets ignores an overdrawn asset, tiles do not add up | 2 | Needs a design answer (real sum recommended). |
| 8 | LED-173 | Home Upcoming Bills omits the overdue installment; Pay now amount differs | 3 | Shares a builder with Accounts' Coming up. |
| 9 | LED-171 | Re-import re-imports the description-less row | 2 | A double count. Small lib fix and a test. |
| 10 | LED-156 | Loan count differs between palette and kind menu | 1 | One shared helper; settle LED-181 item 1 first if a repaid loan should count. |

## Phase 3 — Performance and paging

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 11 | LED-164 | Memoise rows so long lists stay smooth (decides LED-149 item 9) | 8 | Measured: a load step costs 190 ms at 2,000 rows on desktop and 470 ms at 390, on a fast CPU. |
| 12 | LED-165 | Jump to the oldest month lands about 430px short | 3 | Touches the same window hook as LED-164; do it after. |
| 13 | LED-166 | Every route load reads the whole history 4 to 5 times | 8 | Touches `useTransactions` (high degree); keep the diff to the shared read. Do last in the phase so LED-164's numbers are the baseline. |

## Phase 4 — Accessibility and offline polish

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 14 | LED-155 | Mobile Tab order skips the header | 2 | Same file as LED-154. |
| 15 | LED-157 | Browser default outline instead of ring-3 on four elements | 3 | Add the guard test so it holds. |
| 16 | LED-160 | Queue review sheet titles items by table name | 2 | Same file as LED-159. |
| 17 | LED-158 | First-run checklist step 2 is crushed at 390 | 2 | Independent. |
| 18 | LED-163 | "Not synced yet" marker is indigo | 1 | Extend `semanticTokens.test.mjs`. |

## Phase 5 — Small layout and copy

| # | Ticket | Summary | Pts | Why here |
|---|---|---|---|---|
| 19 | LED-161 | Div inside p while Home loads | 1 | Console noise. |
| 20 | LED-167 | "Other · N categories" truncated at 390 and 768 | 1 | Label only. |
| 21 | LED-174 | Cash Flow y axis repeats a label | 1 | Tick helper and a test. |
| 22 | LED-175 | Split dialog category select clipped at 390 | 1 | Layout only. |
| 23 | LED-176 | "A account" in the unique-violation copy | 1 | Copy and a test. |
| 24 | LED-177 | Loan Schedule tile hides the due day on phones | 1 | Layout only. |

## Phase 6 — Verification and decisions (run last, or as soon as a device or an answer is available)

| # | Ticket | Summary | Pts | Notes |
|---|---|---|---|---|
| 25 | LED-178 | Real-device pass: iPhone Safari and installed PWA | 5 | Needs an iPhone. Run after phase 1, so the known phone failures are not rediscovered. |
| 26 | LED-179 | Screen-reader pass | 3 | Needs VoiceOver or NVDA. Run after LED-155 and LED-157. |
| 27 | LED-180 | Scope of "Export my data" and the deletion page copy | 5 | `Blocked` on OD-7. |
| 28 | LED-181 | Sweep notes that need a call (bundle) | 3 | `Blocked` on OD-8. |

Phase totals in points: 1 = 16, 2 = 11, 3 = 19, 4 = 10, 5 = 6, 6 = 16. Sum 78.

## Decision register

| ID | Question | Options | Recommendation | Blocks |
|---|---|---|---|---|
| OD-7 | What does "Export my data" contain, and what does the deletion page list? | (a) every table with user data, one CSV each; (b) only what a user could re-enter, and say so; (c) leave the four CSVs and fix the list | (a) | LED-180 |
| OD-8 | Eleven small inconsistencies from the sweeps (listed in LED-181): repaid loans in the picker, report file prefixes, income budgets in totals, freelance in the 13th Month default, loan dialog titles, two headings on Home, AlertDialog default focus, phone description rule, empty-queue banner copy, result-bar copy, overdue flag on loan detail | per item, each with a Fallback in the ticket | answer them in one pass; most are one-line changes | LED-181 |

Decisions inside a ticket (not blocking): LED-162 (behaviour after a failed sign-out), LED-172 (how an overdrawn asset shows), LED-173 (overdue rows on Home). Each ticket states a recommendation.

### OD-8 answers (phase 6)

1. **Repaid loan in the picker/count** — fix: `loansOwed()` (LED-156) adopted in the repayment picker and the Accounts loan count. → LED-215, Done.
2. **Report file prefixes** — fix: unified on `ledger-report_`. → LED-216, Done.
3. **Income budgets in totals** — fix: excluded into a new `otherType` bucket in `summarizeBudgets()`, shown the same way as `otherCurrency`/`otherPeriod`. → LED-217, Done.
4. **Freelance in the 13th Month default** — no change. `Pd851Checklist` already renders a warning ("N selected records look like this. Untick them to follow PD 851.") whenever a non-salary record is ticked, so the "select all" default plus that warning is the intended UX, not a copy bug. Closed, no ticket.
5. **Loan dialog titles** — no change. `TransactionEntryHeader`'s `title` prop is documented as an intentional override "on the loan's own page" (`AccountTransactionsPage.tsx`); "Record loan repayment" elsewhere is the correct generic title for a flow that hasn't fixed a loan yet. Closed, no ticket.
6. **Two headings on Home** — fix: `DashboardPage.tsx`'s h1 fallback now reads "Home", matching the nav title in `App.tsx`. → LED-220, Done.
7. **AlertDialog default focus** — deferred to LED-179's real screen-reader pass, per that ticket's own AC ("gets an answer from someone who used it"). Not answered here.
8. **Phone description rule** — out of scope for OD-8; owned by LED-153/OD-6.
9. **Empty-queue banner copy** — fix: reads "Offline — you're not connected" when `pendingCount` is 0. → LED-221, Done.
10. **Result-bar copy** — fix: the compact "N match" branch now pluralizes like the full one. → LED-222, Done.
11. **Overdue flag on loan detail** — fix: `daysUntilDue()`/`formatOverdue()` added to `src/lib/loans.ts` and wired into the "Next payment" section. → LED-223, Done.

LED-180 (OD-7) shipped items 1–4 of the recommended (a): savings goals, loan purchases + allocations, and auto-categorisation rule CSVs, plus the accounts export's missing loan-due-days column. Credit card payments, subcategories and exchange rates still have no "read everything for this user" hook to build the CSV from — left open rather than rushed; see the retro for phase 6.

## Things to watch

- **LED-154, LED-155 and LED-157 edit `TopBar.tsx`.** Merge in phase order and keep each diff to its own concern.
- **LED-166 changes how every list reads.** Totals must still equal SQL past 1,000 rows (`rules/page-reads-past-1000-rows.md`); re-run the LED-125 network-log check.
- **LED-164 and LED-165 share the render window.** The oldest-month landing is only reproducible with the window growing in several steps, so test it after LED-164.
- **A ticket is Done only with its sweep item re-run.** Record the before and after numbers in its retro.
- **Not in this epic:** the parked items in `epics-8-13-build-order.md`, and the blocked tickets LED-114, 134, 136, 138, 142, 153 still wait on their decisions (OD-1 to OD-6). Backlog items from the phase 10 to 13 retros that no ticket owned are in `epics-15-19-build-order.md` (LED-182 to LED-214).
