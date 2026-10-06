# Browser case results — 2026-10-06

Latest valid execution per child ID from runs 09–13. Original failures remain in each run; selector corrections are explained in the [summary](QA-20261006-summary.md). This is selected coverage, not completion of each parent family. Google OAuth and visual matrix results are recorded separately.

**48 cases: 44 Pass, 4 Fail.**

| Case | Scenario | Result | Evidence |
|---|---|---|---|
| F-001c | Invalid seeded credentials show an error | Pass | [QA-20261006-09](QA-20261006-09/results.json) |
| F-001d | Fresh fixture user password login and reload | Pass | [QA-20261006-09](QA-20261006-09/results.json) |
| F-001e | Logout redirects and protects a deep link | Pass | [QA-20261006-09](QA-20261006-09/results.json) |
| F-002a | Fresh user sees setup and locked navigation | Pass | [QA-20261006-09](QA-20261006-09/results.json) |
| F-002b | Confirm a changed pay cycle persists | Pass | [QA-20261006-09](QA-20261006-09/results.json) |
| F-002c | Setup completion persists in second browser context | Pass | [QA-20261006-09](QA-20261006-09/results.json) |
| F-003a | Reject empty account name | Pass | [QA-20261006-09](QA-20261006-09/results.json) |
| F-003b | Create cash account with opening balance | Pass | [QA-20261006-09](QA-20261006-09/results.json) |
| F-003c | Create savings and card accounts | Pass | [QA-20261006-09](QA-20261006-09/results.json) |
| F-004a | Reject zero expense amount | Pass | [QA-20261006-09](QA-20261006-09/results.json) |
| F-004b | Expense saves once and debits balance | Pass | [QA-20261006-09](QA-20261006-09/results.json) |
| F-004c | Income credits balance | Pass | [QA-20261006-09](QA-20261006-09/results.json) |
| F-004d | Edit expense and recompute original balance delta | Pass | [QA-20261006-09](QA-20261006-09/results.json) |
| F-004e | Delete expense and undo restores its financial effect once | Pass | [QA-20261006-09](QA-20261006-09/results.json) |
| F-005a | Transfer credits destination and debits source | Pass | [QA-20261006-09](QA-20261006-09/results.json) |
| F-005b | Transfer fee debits source in addition to principal | Pass | [QA-20261006-09](QA-20261006-09/results.json) |
| F-006a | Transfer into credit card creates linked payment and reduces debt | Pass | [QA-20261006-09](QA-20261006-09/results.json) |
| F-007a | Loan repayment credits loan and creates matching allocation | Pass | [QA-20261006-11](QA-20261006-11/results.json) |
| F-008a | Cross-currency transfer credits explicit received amount | Pass | [QA-20261006-09](QA-20261006-09/results.json) |
| F-009a | Scheduled expense is visibly disclosed in account scheduled column | Pass | [QA-20261006-11](QA-20261006-11/results.json) |
| F-009b | Recurring occurrence posts once across two browser contexts | Pass | [QA-20261006-09](QA-20261006-09/results.json) |
| F-010a | Split an expense conserves total and account balance | Pass | [QA-20261006-09](QA-20261006-09/results.json) |
| F-011a | Offline expense queues and syncs once after reconnection | Pass | [QA-20261006-09](QA-20261006-09/results.json) |
| F-012a | Failed accounts read shows error, not empty | Pass | [QA-20261006-09](QA-20261006-09/results.json) |
| F-012b | Read retry recovers after service is restored | Pass | [QA-20261006-09](QA-20261006-09/results.json) |
| F-012c | Failed transaction save preserves entered data | Pass | [QA-20261006-09](QA-20261006-09/results.json) |
| F-013a | Second user cannot read or update first user account | Pass | [QA-20261006-09](QA-20261006-09/results.json) |
| F-014a | Create category budget and persist amount | Pass | [QA-20261006-09](QA-20261006-09/results.json) |
| F-015a | Create and rename expense category | Pass | [QA-20261006-10](QA-20261006-10/results.json) |
| F-016a | Search filters to a matching transaction | Pass | [QA-20261006-09](QA-20261006-09/results.json) |
| F-016b | No-match search is filtered empty, not data loss | Fail | [QA-20261006-09](QA-20261006-09/results.json) |
| F-017a | CSV export includes all 1105 additional records beyond API page limit | Pass | [QA-20261006-09](QA-20261006-09/results.json) |
| F-018a | Global search finds account and navigates | Pass | [QA-20261006-09](QA-20261006-09/results.json) |
| F-019a | Import a standard one-row CSV | Pass | [QA-20261006-10](QA-20261006-10/results.json) |
| F-019b | Reimport detects existing CSV row and skips it by default | Pass | [QA-20261006-12](QA-20261006-12/results.json) |
| F-019c | Reimporting an actual Ledger export preserves expense direction | Fail | [QA-20261006-13](QA-20261006-13/results.json) |
| F-020a | Report CSV download contains persisted transactions | Pass | [QA-20261006-09](QA-20261006-09/results.json) |
| F-021a | Chart lookback changes without changing summary income | Pass | [QA-20261006-10](QA-20261006-10/results.json) |
| F-023a | Create savings goal with initial progress | Pass | [QA-20261006-10](QA-20261006-10/results.json) |
| F-024a | Save and reopen a transaction template | Pass | [QA-20261006-13](QA-20261006-13/results.json) |
| F-025a | Attach receipt PNG and persist its reference | Pass | [QA-20261006-12](QA-20261006-12/results.json) |
| F-026a | 13th-month inclusion selection persists after reload | Pass | [QA-20261006-12](QA-20261006-12/results.json) |
| F-027a | Profile display name persists through reload | Pass | [QA-20261006-10](QA-20261006-10/results.json) |
| F-029a | Public legal routes render logged out | Pass | [QA-20261006-09](QA-20261006-09/results.json) |
| F-029b | Unknown URL has a meaningful fallback | Fail | [QA-20261006-09](QA-20261006-09/results.json) |
| V-007a | Account form labels reference actual form controls | Fail | [QA-20261006-09](QA-20261006-09/results.json) |
| V-007b | Escape dismisses account form and returns focus | Pass | [QA-20261006-10](QA-20261006-10/results.json) |
| V-009a | Dark theme persists across reload | Pass | [QA-20261006-10](QA-20261006-10/results.json) |
