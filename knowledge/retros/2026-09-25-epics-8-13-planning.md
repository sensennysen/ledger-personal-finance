# Epics 8 to 13 — planning retro (2026-09-25)

## What was done
- Audited the shipped redesign (Epics 0 to 7, LED-01 to LED-103, `main` at `98d03ef`) against `design_handoff_ledger_ui_audit/`, the ticket CSVs and every retro. Lint, build and 378 tests were green; the audit was by code reading, not in a browser (sign-in is Google OAuth).
- Wrote six epics with 50 tickets (LED-104 to LED-153, 256 points) and `docs/dev-tasks/ledger-ui-redesign/epics-8-13-build-order.md`: 13 phases, a decision register (OD-1 to OD-6), a parked list and a finding-to-ticket map.
- No application code and no existing CSV was changed. Fixing the stale statuses is ticket LED-121.

## Findings that no retro had recorded
- **The add-transaction spec was only partly ticketed.** `specs/add-transaction-spec.md` Sections 1.3 and 4 became LED-08/LED-24 and LED-103. Sections 1.1, 1.2, 1.4, 1.5, 2 and 3.2 to 3.5 became no ticket, so README Part 1 #3 (loan auto-pick, High) is still live at `TransactionForm.tsx:272-275`. `tickets.md` LED-91 assumes the 5b picker exists.
- **`GOLD` silently changed colour.** `constants/colors.ts` defines `GOLD = 'var(--primary)'`. LED-53, 77 and 93 were built while `--primary` was gold. LED-100 re-seeded `--primary` to indigo and added `--warning` tokens, but no solid gold token and no repoint. Eight sites now render indigo where the design draws gold.
- **Opacity is still used for disabled states**, in 12 `ui/` files (including `Button`) and four other files, against the handoff's hard rule.

## Why they escaped
- `tickets.md` was cut from the specs once, and nothing checked the tickets back against every spec section. A spec section with no ticket has no owner, so no retro could mention it.
- Each ticket's retro checks its own acceptance line. A later ticket changing a token that an earlier ticket relied on is invisible to both retros.
- Retros marked acceptance PASS "in code" for visual work. 73 Backlogs say "not verified live".

## Decisions made while planning
- LED-152 (Categories 8a) was planned at 5 points and raised to 8 after reading the 8a caption, which lists usage columns, a detail pane, an Unused tab and a labelled rules button. Merge and the single Reorder control are parked.
- LED-135 covers Reports as well as Home, because both call `getBalanceSummary`.
- Rows that need a product answer are `Blocked` with a **Fallback:** sentence instead of being guessed: OD-1 (widget-order backfill), OD-2 (card payments category), OD-3 (exchange rates), OD-4 (saved filters), OD-5 (legal copy), OD-6 (QuickEntry conveniences).
- The dev-tasks-planner Day-0 and Day-1 rules do not apply: no new row is `Done`, and no sibling CSV in this repo uses them. `Blocked` and **Fallback:** are used only where a decision is genuinely pending.

## Backlog
- Nothing in these epics is built. The plan has not been run through `/evaluate` per phase.
- Candidate patterns once the work lands: "a token alias is re-checked when its target is re-seeded" (LED-115) and "every spec section maps to a ticket" (a coverage check for `tickets.md`).
- The finding-to-ticket map covers retro Backlogs at the level of detail the retros give. Some minor Backlog lines (for example the LED-40 "Cmd+K opens over other dialogs" note) live inside the LED-124 sweep checklist rather than their own ticket.

## Issues found in validate
- LED-116 said the 22a offline pending banner has a gold border. It does not: 22a fills the banner with `--warning-container`, uses `--warning` ink and a "Sync now" pill in that ink. The gold border in 22a is on the conflict chip in the review sheet. Corrected in the CSV. The banner needs only the tokens that already exist; `--gold` (LED-115) is for borders and fills such as the Over budget tile.
- 186 file and line references in the descriptions were checked: every existing file resolves and no line is out of range. 45 spot-checked lines were confirmed by content. The only unresolved names are files the tickets will create (`loanPicker.ts`, `loanRepayment.ts`, `kindMenu.ts`, `transactionKindChange.ts`, two new tests).

## Design claims still to confirm during /evaluate
- LED-117: the three budget-bar bands against 4b and 18a (the ticket says so).
- LED-113: whether 12a draws a preselected card when several cards owe.
- LED-141: gold for partial months is a suggestion, not drawn in 15a.
- LED-144: the "install Ledger" prompt copy comes from the LED-96 retro's reading of 11a, not from the frame itself.
Lesson: a design claim in ticket text should quote the frame it came from. One claim here was written from a colour hex search and was wrong until the frame was read.
