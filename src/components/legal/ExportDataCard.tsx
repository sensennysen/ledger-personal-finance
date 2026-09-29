import { Link } from 'react-router-dom'
import { Download } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { useAccounts } from '@/hooks/useAccounts'
import { useBudgets } from '@/hooks/useBudgets'
import { useCategories } from '@/hooks/useCategories'
import { useCreditCardPayments } from '@/hooks/useCreditCardPayments'
import { useExchangeRateRow } from '@/hooks/useExchangeRateRow'
import { useLoanPurchases } from '@/hooks/useLoanPurchases'
import { useSavingsGoals } from '@/hooks/useSavingsGoals'
import { useAllSubcategories } from '@/hooks/useSubcategories'
import { useTransactionRules } from '@/hooks/useTransactionRules'
import { useTransactions } from '@/hooks/useTransactions'
import {
  buildAccountsCsv,
  buildBudgetsCsv,
  buildCategoriesCsv,
  buildCreditCardPaymentsCsv,
  buildExchangeRatesCsv,
  buildLoanAllocationsCsv,
  buildLoanPurchasesCsv,
  buildSavingsGoalsCsv,
  buildSubcategoriesCsv,
  buildTransactionRulesCsv,
  exportFileName,
  type ExportKind,
} from '@/lib/dataExport'
import { exchangeRateRows } from '@/lib/exchangeRates'
import { buildRunningBalanceMap } from '@/lib/runningBalance'
import { buildTransactionsCsv, downloadCsv } from '@/lib/transactionCsv'
import { resolveLoadState, type LoadState } from '@/lib/loadState'
import { getLocalDateString } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { InlineLoadError } from '@/components/ui/error-state'

// "Rather export first?" beside the deletion instructions (LED-89, LED-143, LED-180). The page
// is public, so a signed-out visitor is sent to sign in; a signed-in one gets a file for each
// thing the page says we hold: transactions (with Standing Balance, from the same function
// Reports uses), accounts, categories, budgets, savings goals, loan purchases and their
// allocations, auto-categorisation rules, subcategories, credit card payments and exchange
// rates. Each file has its own read, so a failed one shows its error and offers no download,
// and never writes an empty or partial file.

export function ExportDataCard() {
  const { user, loading } = useAuth()

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <p className="text-sm font-semibold text-foreground">Rather export first?</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Download your data as CSV before deleting — it can't be recovered afterwards.
      </p>
      <div className="mt-3">
        {loading ? (
          <Button size="sm" variant="outline" disabled>
            <Download className="h-4 w-4" />
            Export my data
          </Button>
        ) : user ? (
          // This page sits outside the app layout, and useAccounts reports through the notification surface.
          <NotificationProvider>
            <SignedInExport />
          </NotificationProvider>
        ) : (
          <Link to="/login" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Sign in to export
          </Link>
        )}
      </div>
    </div>
  )
}

function SignedInExport() {
  const transactions = useTransactions()
  const accounts = useAccounts()
  const categories = useCategories()
  const budgets = useBudgets()
  const savingsGoals = useSavingsGoals()
  const loanPurchases = useLoanPurchases()
  const transactionRules = useTransactionRules(true)
  const subcategories = useAllSubcategories()
  const creditCardPayments = useCreditCardPayments()
  const exchangeRate = useExchangeRateRow()

  // Standing Balance needs every account's live balance, so a failed accounts read fails this file too.
  const transactionsState = resolveLoadState({
    loading: transactions.loading || accounts.loading,
    error: transactions.error ?? accounts.error,
    hasData: transactions.transactions.length > 0,
  })
  const accountsState = resolveLoadState({ loading: accounts.loading, error: accounts.error, hasData: accounts.accounts.length > 0 })
  const categoriesState = resolveLoadState({ loading: categories.loading, error: categories.error, hasData: categories.categories.length > 0 })
  const budgetsState = resolveLoadState({ loading: budgets.loading, error: budgets.error, hasData: budgets.budgets.length > 0 })
  const savingsGoalsState = resolveLoadState({ loading: savingsGoals.loading, error: savingsGoals.error, hasData: savingsGoals.goals.length > 0 })
  const loanPurchasesState = resolveLoadState({ loading: loanPurchases.loading, error: loanPurchases.error, hasData: loanPurchases.purchases.length > 0 })
  // The allocations file shares the loan purchases read: allocations only exist for a purchase, and a failed
  // purchases read leaves both empty, so one retry (below) covers both files.
  const loanAllocationsState = resolveLoadState({ loading: loanPurchases.loading, error: loanPurchases.error, hasData: loanPurchases.allocations.length > 0 })
  const transactionRulesState = resolveLoadState({ loading: transactionRules.loading, error: transactionRules.error, hasData: transactionRules.rules.length > 0 })
  const subcategoryCount = Object.values(subcategories.subcategoriesByCategoryId).reduce((n, list) => n + list.length, 0)
  const subcategoriesState = resolveLoadState({ loading: subcategories.loading, error: subcategories.error, hasData: subcategoryCount > 0 })
  const creditCardPaymentsState = resolveLoadState({ loading: creditCardPayments.loading, error: creditCardPayments.error, hasData: creditCardPayments.payments.length > 0 })
  const exchangeRateRowCount = exchangeRate.table ? exchangeRateRows(exchangeRate.table).length : 0
  const exchangeRateState = resolveLoadState({ loading: exchangeRate.loading, error: exchangeRate.error, hasData: exchangeRateRowCount > 0 })

  const save = (kind: ExportKind, csv: string) => downloadCsv(csv, exportFileName(kind, getLocalDateString()))

  return (
    <>
      <ul className="space-y-2">
        <ExportRow
          label="Transactions"
          count={transactions.transactions.length}
          state={transactionsState}
          onRetry={() => { void transactions.refetch(); void accounts.refetch() }}
          onExport={() =>
            save('transactions', buildTransactionsCsv(transactions.transactions, buildRunningBalanceMap(accounts.accounts, transactions.transactions)))
          }
        />
        <ExportRow
          label="Accounts"
          count={accounts.accounts.length}
          state={accountsState}
          onRetry={() => void accounts.refetch()}
          onExport={() => save('accounts', buildAccountsCsv(accounts.accounts))}
        />
        <ExportRow
          label="Categories"
          count={categories.categories.length}
          state={categoriesState}
          onRetry={() => void categories.refetch()}
          onExport={() => save('categories', buildCategoriesCsv(categories.categories))}
        />
        <ExportRow
          label="Budgets"
          count={budgets.budgets.length}
          state={budgetsState}
          onRetry={() => void budgets.refetch()}
          onExport={() => save('budgets', buildBudgetsCsv(budgets.budgets))}
        />
        <ExportRow
          label="Savings goals"
          count={savingsGoals.goals.length}
          state={savingsGoalsState}
          onRetry={() => void savingsGoals.refetch()}
          onExport={() => save('savings-goals', buildSavingsGoalsCsv(savingsGoals.goals))}
        />
        <ExportRow
          label="Loan purchases"
          count={loanPurchases.purchases.length}
          state={loanPurchasesState}
          onRetry={() => void loanPurchases.refetch()}
          onExport={() =>
            save(
              'loan-purchases',
              buildLoanPurchasesCsv(
                loanPurchases.purchases.map((p) => ({ ...p, account: accounts.accounts.find((a) => a.id === p.account_id) })),
              ),
            )
          }
        />
        <ExportRow
          label="Loan payment allocations"
          count={loanPurchases.allocations.length}
          state={loanAllocationsState}
          onRetry={() => void loanPurchases.refetch()}
          onExport={() =>
            save(
              'loan-allocations',
              buildLoanAllocationsCsv(
                loanPurchases.allocations.map((a) => ({
                  ...a,
                  loanPurchase: loanPurchases.purchases.find((p) => p.id === a.loan_purchase_id),
                })),
              ),
            )
          }
        />
        <ExportRow
          label="Auto-categorisation rules"
          count={transactionRules.rules.length}
          state={transactionRulesState}
          onRetry={() => void transactionRules.refetch()}
          onExport={() => save('transaction-rules', buildTransactionRulesCsv(transactionRules.rules))}
        />
        <ExportRow
          label="Subcategories"
          count={subcategoryCount}
          state={subcategoriesState}
          onRetry={() => void subcategories.refetch()}
          onExport={() =>
            save(
              'subcategories',
              buildSubcategoriesCsv(
                Object.entries(subcategories.subcategoriesByCategoryId).flatMap(([categoryId, list]) =>
                  list.map((s) => ({ ...s, category: categories.categories.find((c) => c.id === categoryId) })),
                ),
              ),
            )
          }
        />
        <ExportRow
          label="Credit card payments"
          count={creditCardPayments.payments.length}
          state={creditCardPaymentsState}
          onRetry={() => void creditCardPayments.refetch()}
          onExport={() =>
            save(
              'credit-card-payments',
              buildCreditCardPaymentsCsv(
                creditCardPayments.payments.map((p) => ({ ...p, account: accounts.accounts.find((a) => a.id === p.account_id) })),
              ),
            )
          }
        />
        <ExportRow
          label="Exchange rates"
          count={exchangeRateRowCount}
          state={exchangeRateState}
          onRetry={() => void exchangeRate.refetch()}
          onExport={() => save('exchange-rates', buildExchangeRatesCsv(exchangeRate.table ? exchangeRateRows(exchangeRate.table) : []))}
        />
      </ul>
    </>
  )
}

function ExportRow({
  label,
  count,
  state,
  onExport,
  onRetry,
}: {
  label: string
  count: number
  state: LoadState
  onExport: () => void
  onRetry: () => void
}) {
  const failed = state === 'error' || state === 'stale-error'
  return (
    <li className="space-y-1.5">
      {failed ? (
        <InlineLoadError message={`Couldn't load your ${label.toLowerCase()}, so there's nothing safe to export yet.`} onRetry={onRetry} />
      ) : state === 'empty' ? (
        <p className="text-sm text-muted-foreground">No {label.toLowerCase()} to export.</p>
      ) : (
        // Disabled while loading, including a cached copy still being refreshed.
        <Button size="sm" variant="outline" onClick={onExport} disabled={state === 'loading'}>
          <Download className="h-4 w-4" />
          {state === 'loading' ? `Loading your ${label.toLowerCase()}…` : `Export ${label.toLowerCase()} (${count})`}
        </Button>
      )}
    </li>
  )
}
