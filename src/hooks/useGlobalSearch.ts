import { useMemo } from 'react'
import { useCycle } from '@/contexts/cycleState'
import { useTransactions } from '@/hooks/useTransactions'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { useLoanPurchases } from '@/hooks/useLoanPurchases'
import { getCustomMonthRange } from '@/lib/utils'
import { resolveLoadState } from '@/lib/loadState'
import {
  buildDueSoon,
  capGroup,
  matchActions,
  parseAmountQuery,
  searchNamed,
  searchTransactions,
  summarizeLoans,
  type SearchAction,
  type SearchScope,
} from '@/lib/globalSearch'

/**
 * Search over transactions, accounts, categories and actions. The cycle is
 * never applied implicitly: `scope` says whether to search the shell's selected
 * cycle or all time, and `range` is returned so the UI can state which.
 */
export function useGlobalSearch(query: string, scope: SearchScope, actions: SearchAction[]) {
  const { startDay, selectedMonth } = useCycle()
  const transactions = useTransactions()
  const accounts = useAccounts()
  const categories = useCategories()
  // Loans only feed the before-you-type state, so they load only while the query is empty.
  const emptyQuery = query.trim() === ''
  const loans = useLoanPurchases(undefined, emptyQuery)

  const range = useMemo(
    () => getCustomMonthRange(selectedMonth, startDay),
    [selectedMonth, startDay],
  )

  const results = useMemo(() => {
    const matches = searchTransactions(transactions.transactions, query, scope, range)
    return {
      exact: capGroup(matches.exact),
      nearby: capGroup(matches.nearby),
      text: capGroup(matches.text),
      accounts: capGroup(searchNamed(accounts.accounts, query)),
      categories: capGroup(searchNamed(categories.categories, query)),
      actions: matchActions(actions, query),
    }
  }, [transactions.transactions, accounts.accounts, categories.categories, query, scope, range, actions])

  const deadlines = loans.deadlines
  const dueSoon = useMemo(() => {
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const accountByPurchase = new Map(loans.purchases.map((purchase) => [purchase.id, purchase.account_id]))
    return buildDueSoon(deadlines, today).map((row) => ({
      ...row,
      accountId: accountByPurchase.get(row.purchaseId) ?? null,
    }))
  }, [deadlines, loans.purchases])
  const loanSummary = useMemo(() => summarizeLoans(deadlines), [deadlines])

  const error = transactions.error ?? accounts.error ?? categories.error ?? loans.error
  const loadState = resolveLoadState({
    loading: transactions.loading || accounts.loading || categories.loading || loans.loading,
    error,
    hasData:
      transactions.transactions.length > 0 ||
      accounts.accounts.length > 0 ||
      categories.categories.length > 0,
  })

  const refetch = () => {
    void transactions.refetch()
    void accounts.refetch()
    void categories.refetch()
    void loans.refetch()
  }

  return {
    results,
    range,
    dueSoon,
    loanSummary,
    isAmountQuery: parseAmountQuery(query) !== null,
    loadState,
    error,
    refetch,
  }
}
