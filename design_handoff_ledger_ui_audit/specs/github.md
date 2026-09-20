repo: sensennysen/ledger-personal-finance
branch: redesign-v1
path: src

## Last sync

date: 2026-09-17T16:40:00Z

### Updated in this project

- Resolved the five follow-on product decisions (deficit clamps at zero with the remainder reported, existing users keep `carry`, Reports presets a clean break, import duplicates default to skip, first-run advisory) — nothing in the backlog is blocked
- Cut the audit into build-ready tickets — `docs/tickets.md`: 8 epics, ~60 tickets with dependencies, sizes and acceptance criteria, opening with a feature-impact register (what the redesign adds / changes / limits / removes) and the four items still needing a product decision
- Answered the data-volume question (~2,000 transactions per account, 4–8 accounts, 20–50 categories) and drew section 29a — dense states for Activity, Reports, global search and Import CSV at those ceilings
- Converted the whole design document to a single token set so all 29 sections render in light or dark; recorded the dark token pairing for `index.css`
- Removed the duplicate kind selector from the create modal (4c) and added the edit variant that carries it
- Built the Legal pages (24a) — screen inventory now complete
- Wrote `docs/ui-audit-spec.md` — the full audit as an implementable spec (bugs, nav shell, shared components, per-screen changes, suggested order)
- Built Budget & goal forms (23a) — completing the screen inventory — Offline & sync states (22a), the Loan purchase tracker (21a), empty & first-run states (20a), the Account form (19a) and the Home screen (18a) from the real `DEFAULT_WIDGET_ORDER`, the Dashboard detail pane & widget settings sheet (17a), Global search (16a, new flow), the 13th Month Pay estimator (15a), Loan purchase form (14a), Split transaction (13a) and the Transaction detail pane (13b), Card payment modal (12a, new flow), Login (11a), Import CSV dialog (10a), Reports (9a), Categories (8a), Accounts list (6a) and Settings (7a) on the 2B model at 1920 / 768 / 390, each with an annotated list of proposed improvements.
- Audited `App.tsx` routes against the mockup backlog: five undesigned modal/sheet screens found (Import CSV, dashboard detail dialogs, widget settings sheet, loan purchase form, legal pages), plus a missing `/terms` routeMeta entry.

- Built the 2B navigation model (top-bar tabs, no rail) for Account detail, Budgets & Goals and Transaction entry at 1920 / 768 / 390, in the branch's M3 tokens.
- Removed the mobile numeric keypad from Transaction entry; Payee, Note, tags and the recurring toggle now occupy that space.
- Mocked up the Add-Transaction kind menu from `TransactionKindMenu.tsx` (shipping vs proposed, with a Liabilities group and outstanding amounts).
- Mocked up the Record loan repayment modal from `TransactionForm.tsx` — locked expense type, "Loan to repay" first, filtered "Pay from", required category, outstanding cap, and an installment allocation preview.

### Updated in this project

- Completed tablet 768 coverage — added 14 missing frames (5a, 5b, 10a, 12a, 13a, 13b, 14a, 15a, 16a, 17a, 18a, 19a, 20a, 21a, 22a, 23a, 24a); every screen and flow now carries all three viewports, with field parity and per-section viewport coverage verified by enumerating the document
- Produced the developer handoff package in `design_handoff_ledger_ui_audit/`

- Built loading & skeleton states (25a) from `ui/skeleton.tsx` and its 14 call sites

- Built error states (26a); added Part 1 items 34-40 and a Part 2 notification-surface entry

- Built motion & focus order (27a); added Part 1 items 41-46

- Recorded the four resolved product decisions (D1 deficit setting, D1b overspend reporting, D2 13th-month route, D3 global cycle, D4 card payment ships); fixed spec section numbering

- Drew the design implied by D1/D1b/D3 as section 28a; cross-linked from 9a and 23a

## Screen map

| Project screen | Repo files |
|---|---|
| Nav shell (`LedgerRail.dc.html`, `LedgerBottomNav.dc.html`) | `src/components/layout/AppLayout.tsx`, `Sidebar.tsx`, `BottomNav.tsx`, `CycleStepper.tsx`, `src/index.css` |
| Home | `src/pages/DashboardPage.tsx`, `src/hooks/useDashboardData.ts` |
| Activity | `src/pages/TransactionsPage.tsx`, `src/components/transactions/TransactionRow.tsx` |
| Account detail | `src/pages/AccountTransactionsPage.tsx`, `src/lib/creditCards.ts` |
| Budgets & Goals | `src/pages/BudgetsPage.tsx`, `src/components/layout/CycleStepper.tsx` |
| Transaction entry | `src/components/transactions/TransactionForm.tsx`, `QuickEntry.tsx`, `transactionFormSchema.ts`, `src/components/ui/dialog.tsx` |
| Kind menu (5a) | `src/components/transactions/TransactionKindMenu.tsx`, `transactionKinds.ts` |
| Loan repayment (5b) | `src/components/transactions/TransactionForm.tsx`, `src/components/accounts/LoanPurchaseForm.tsx`, `LoanPurchaseTracker.tsx`, `src/lib/loanInstallments.ts`, `src/lib/loans.ts`, `src/hooks/useLoanPurchases.ts` |
| Accounts list (6a) | `src/pages/AccountsPage.tsx`, `src/lib/creditCards.ts`, `src/lib/loans.ts`, `src/constants/accounts.ts` |
| Settings (7a) | `src/pages/SettingsPage.tsx`, `src/components/settings/ExchangeRatesSettings.tsx`, `src/contexts/ThemeContext.tsx`, `src/hooks/usePreferences.ts`, `src/hooks/useMonthCycle.ts` |
| Categories (8a) | `src/pages/CategoriesPage.tsx`, `src/hooks/useCategories.ts`, `useSubcategories.ts`, `useTransactionRules.ts`, `useFlipReorder.ts` |
| Reports (9a) | `src/pages/ReportsPage.tsx`, `src/hooks/useReportPresets.ts`, `src/lib/currency.ts`, `src/constants/colors.ts` |
| Import CSV (10a) | `src/components/transactions/ImportCSVDialog.tsx`, `src/hooks/useAccounts.ts`, `src/lib/utils.ts` |
| Login (11a) | `src/pages/LoginPage.tsx`, `src/contexts/AuthContext.tsx`, `src/contexts/ThemeContext.tsx` |
| Card payment (12a) | `src/lib/creditCards.ts`, `src/components/transactions/TransactionForm.tsx`, `TransactionKindMenu.tsx` — new flow, see `docs/add-transaction-spec.md` §1.3 |
| Split transaction (13a) | `src/components/transactions/SplitTransactionDialog.tsx`, `src/hooks/useCategories.ts` |
| Transaction detail (13b) | `src/components/transactions/EntryDetail.tsx`, `TransactionTagsField.tsx`, `TransactionReceiptField.tsx` |
| Loan purchase form (14a) | `src/components/accounts/LoanPurchaseForm.tsx`, `src/lib/loanInstallments.ts`, `src/hooks/useLoanPurchases.ts` |
| 13th Month Pay (15a) | `src/pages/ThirteenthMonthPage.tsx`, `src/hooks/useExchangeRates.ts`, `src/lib/currency.ts`, `src/constants/colors.ts` |
| Global search (16a) | `src/components/ui/command.tsx` (unused `CommandDialog`), `AccountCombobox.tsx`, `src/hooks/useMonthCycle.ts` — new flow |
| Dashboard detail + widgets (17a) | `src/components/dashboard/DashboardDetailSurface.tsx`, `DashboardWidgetSettingsSheet.tsx`, `src/hooks/useDashboardPrefs.ts` (widget keys, labels and default order read verbatim) |
| Home (18a) | `src/hooks/useDashboardPrefs.ts`, `src/components/dashboard/DashboardCreditCardMonitor.tsx`, `DashboardCashFlowForecastCard.tsx`, `src/hooks/useDashboardData.ts` |
| Account form (19a) | `src/pages/AccountsPage.tsx` (`AccountForm`), `src/pages/AccountTransactionsPage.tsx` (`EditAccountForm` — separate schema), `src/constants/accounts.ts`, `src/lib/loans.ts` (`LOAN_PAY_PERIOD_LABELS`, `WEEKDAY_LABELS`, `formatLoanSchedule` read verbatim) |
| Empty & first-run (20a) | `src/components/ui/empty-state.tsx`, `src/pages/TransactionsPage.tsx`, `AccountsPage.tsx`, `AccountTransactionsPage.tsx`, `BudgetsPage.tsx`, `src/components/dashboard/DashboardRecentTransactionsCard.tsx`, `DashboardDetailDialogs.tsx` |
| Loan purchase tracker (21a) | `src/components/accounts/LoanPurchaseTracker.tsx`, `src/hooks/useLoanPurchases.ts`, `src/lib/loanInstallments.ts`, `src/lib/loans.ts` |
| Offline & sync (22a) | `src/components/layout/OfflineBanner.tsx`, `src/hooks/useNetworkStatus.ts`, `src/lib/offlineQueue.ts`, `src/lib/receiptStore.ts`, `src/hooks/useTransactions.ts` |
| Budget & goal forms (23a) | `src/pages/BudgetsPage.tsx` (`BudgetForm`, `GoalForm`), `src/hooks/useBudgets.ts`, `src/hooks/useSavingsGoals.ts`, `src/lib/budgetCycle.ts` |
| Legal pages (24a) | `src/pages/PrivacyPolicyPage.tsx`, `TermsOfServicePage.tsx`, `DataDeletionPage.tsx`, `src/App.tsx` (routeMeta) |
| Shared primitives | `src/components/ui/{card,button-variants,badge,tabs,progress,label}.tsx`, `src/constants/{accounts,colors}.ts` |

## Sync history

- 2026-09-17T11:15:00Z — recorded the four resolved product decisions (D1–D4) and drew section 28a; completed tablet coverage, loading/error/motion sections (25a–27a) and the developer handoff package.

- 2026-09-10T14:25:17Z — 2B nav model applied to Account detail, Budgets & Goals and Transaction entry; keypad removed from mobile entry; kind menu and loan repayment modal mocked up; `docs/add-transaction-spec.md` written.

- 2026-09-10T02:23:46Z — recreated the shipping redesign-v1 UI (Home, Activity, Account detail, Budgets & Goals, Transaction entry) and the nav shell from `src/index.css` M3 tokens; added the first round of navigation proposals.
