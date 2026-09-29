# LED-181 · Sweep notes that needed a call (OD-8) — retro (2026-09-29)

## What shipped
Answered all 11 items in `epic-14-build-order.md`'s decision register. Seven needed a code change, each spun into its own ticket and shipped in the same pass (`74748ad`):

1. Repaid loan in the picker/count → **LED-215**. `loansOwed()` (LED-156) adopted in `TransactionForm.tsx`'s new-repayment picker/gate and `AccountsPage.tsx`'s loan count; `TransactionForm.tsx` keeps the unfiltered list for resolving an existing repayment against a since-repaid loan when editing.
2. Report file prefixes → **LED-216**. `ReportsPage.tsx`'s PDF export now saves as `ledger-report_...pdf`, matching the CSV.
3. Income-category budget in totals → **LED-217**. `useBudgets.ts` now selects `category.type`; `summarizeBudgets()` excludes it into a new `otherType` bucket, shown by `BudgetSummaryTiles` the same way as `otherCurrency`/`otherPeriod`.
6. Two headings on Home → **LED-220**. `DashboardPage.tsx`'s h1 fallback now reads "Home", matching `App.tsx`'s route title.
9. Empty-queue offline banner copy → **LED-221**. `OfflineBanner.tsx` drops the "0 entries" clause when `pendingCount` is 0.
10. Compact result-bar copy → **LED-222**. `ResultBar.tsx`'s compact branch now pluralizes "match"/"matches" like the full one.
11. Loan detail's missing overdue flag → **LED-223**. New `daysUntilDue()`/`formatOverdue()` in `src/lib/loans.ts` (local-midnight date math, mirroring the pattern `loanInstallments.ts` already uses privately), wired into `AccountTransactionsPage.tsx`'s "Next payment".

Two items closed with **no code change**, after checking the actual behaviour rather than assuming the ticket's framing was a bug:
4. 13th Month Freelance default — `Pd851Checklist` already renders a warning ("N selected records look like this. Untick them to follow PD 851.") whenever a non-salary record is ticked. "Select all by default, plus a warning" is the intended UX, not a copy mismatch.
5. Loan dialog title — `TransactionEntryHeader`'s `title` override is documented as intentional "on the loan's own page"; the generic "Record loan repayment" elsewhere is correct for a flow that hasn't fixed a loan yet.

One item deferred (7: AlertDialog focus, to LED-179's real screen-reader pass, per that ticket's own AC) and one out of scope (8: phone description rule, owned by LED-153/OD-6).

## Acceptance
- "Each item answered in the decision register of epic-14-build-order.md": **PASS**.
- "answered items become their own small ticket or are closed": **PASS** — 7 tickets (LED-215–217, 220–223), 2 closed with no ticket, 1 deferred, 1 out of scope.
- Lint, `tsc -b`, `pnpm build`, full test suite (763 tests): PASS.

## Backlog
- **Edge case not fully closed by item 1's fix**: if a user has exactly one loan account that still owes money but at least one other loan account that's fully repaid, `resolveInitialLoanId()` (in `loanPicker.ts`) still receives the *unfiltered* `loanAccounts` list, sees `length !== 1`, and does not auto-select the one real loan. The user lands on the plain "Loan to repay" combobox instead of being auto-picked in — not broken (the combobox still lets them choose correctly), but not as smooth as the single-real-loan case is elsewhere. Left alone rather than risk breaking the edit-mode resolution path (`resolveInitialLoanId` needs the full, unfiltered list to find an existing repayment against a since-repaid loan). Would need a separate, owed-only variable threaded into just the auto-pick effect.
- The "Loan to repay" inline `AccountCombobox` (`TransactionForm.tsx`, distinct from the `LoanPicker` screen LED-215 fixed) still lists a fully repaid loan as a choice. Ticket LED-181 item 1's wording named the picker and the count specifically, not this fallback field, so it was left as is — worth a follow-up if it turns out confusing in practice.
- None of the 7 shipped items were re-verified live in a browser this session (no `claude-in-chrome` tab used) — verification here is `tsc -b` + lint + the full `node --test` suite (763 tests) + `pnpm build`, not a click-through.
