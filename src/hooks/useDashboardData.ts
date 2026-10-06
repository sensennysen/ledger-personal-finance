import { useMemo } from 'react'
import {
  getCurrentCycleMonthKey,
  getCustomMonthRange,
  getLocalDateString,
  groupExpensesByCategory,
} from '@/lib/utils'
import { computeNextDueDate } from '@/lib/recurringTransactions'
import {
  getCreditCardSpending,
  getCreditUtilizationPct,
  daysUntilDayOfMonth,
} from '@/lib/creditCards'
import { summarizeBalances } from '@/lib/accountsOverview'
import { sumConverted } from '@/lib/convertedTotals'
import { countedEnd, countsYet } from '@/lib/countsYet'
import { scheduledNetWorth } from '@/lib/scheduledBalances'
import type { ConvertFn, RateTable } from '@/lib/exchangeRates'
import { buildUpcomingLoanBills } from '@/lib/loanInstallments'
import { buildCashFlowForecast, type CashFlowForecast, type CashFlowForecastItem as ForecastItem } from '@/lib/cashFlowForecast'
import type { Account, Category, LoanPaymentAllocation, LoanPurchase, Transaction } from '@/types'

export type DashboardChartPeriod = 'week' | 'month' | 'quarterly' | 'yearly'
export type DashboardCashFlowPoint = {
  label: string
  income: number
  expenses: number
}

export type DashboardExpenseCategoryBreakdown = {
  name: string
  color: string
  icon: string
  amount: number
}

export type DashboardExpenseCategoryDetail = DashboardExpenseCategoryBreakdown & {
  categoryId: string | null
  percentage: number
  transactions: Transaction[]
}

export type DashboardStatsSummary = {
  totalBalance: number
  totalAssets: number
  totalCreditCardDebt: number
  /** Currencies left out of the balance figures (no exchange rate). */
  excludedCurrencies: string[]
  income: number
  expenses: number
  net: number
  /** Income and expenses dated later in the cycle: scheduled, not yet counted above (LED-238). */
  upcomingIncome: number
  upcomingExpenses: number
  /** Currencies left out of income/expenses/net (no exchange rate); distinct from the balance figures above. */
  excludedFlowCurrencies: string[]
  /** What rows dated after today already added to `totalBalance`, which is stored (LED-251). */
  scheduledNetWorth: number
}

type RecurringTransaction = Transaction & {
  recurrence_interval: NonNullable<Transaction['recurrence_interval']>
}

type RecurringSeriesItem = {
  key: string
  tx: RecurringTransaction
}

export type UpcomingBill = {
  key: string
  source: 'recurring' | 'loan'
  title: string
  icon: string | null
  color: string
  amount: number
  currency: string
  detail: string | null
  nextDue: Date
  daysUntil: number | null
  /** The loan this bill pays, with the amount and due date the form opens on (Pay now, LED-145). Only loan bills have one. */
  payment: { accountId: string; amount: number; date: string } | null
}

export type CashFlowForecastItem = ForecastItem<RecurringTransaction>

export type DashboardCashFlowForecast = CashFlowForecast<RecurringTransaction>

export type CreditCardWithState = {
  acc: Account
  spending: number
  utilizationPct: number
  targetPct: number
  statementCountdown: number | null
  dueCountdown: number | null
  amountToPay: number
  paidAmount: number
  remainingToPay: number
  paymentReminder: boolean
  statementReminder: boolean
  nearLimit: boolean
}

function createDateAtLocalMidnight(date: string) {
  return new Date(`${date}T00:00:00`)
}

function addMonthsToKey(monthKey: string, delta: number) {
  const [year, month] = monthKey.split('-').map(Number)
  const value = new Date(year, month - 1 + delta, 1)
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function getCashFlowPeriods(
  chartPeriod: DashboardChartPeriod,
  selectedMonth: string,
  monthStart: string,
  monthEnd: string,
  startDay: number,
) {
  if (chartPeriod === 'month') {
    const periods: Array<{ label: string; start: string; end: string }> = []
    const cursor = createDateAtLocalMidnight(monthStart)
    const end = createDateAtLocalMidnight(monthEnd)

    while (cursor <= end) {
      const date = getLocalDateString(cursor)
      periods.push({ label: String(cursor.getDate()), start: date, end: date })
      cursor.setDate(cursor.getDate() + 1)
    }

    return periods
  }

  if (chartPeriod === 'week') {
    const periods: Array<{ label: string; start: string; end: string }> = []
    const cursor = createDateAtLocalMidnight(monthStart)
    const cycleEnd = createDateAtLocalMidnight(monthEnd)

    while (cursor <= cycleEnd) {
      const rangeStart = new Date(cursor)
      const rangeEnd = new Date(cursor)
      rangeEnd.setDate(rangeEnd.getDate() + 6)
      if (rangeEnd > cycleEnd) rangeEnd.setTime(cycleEnd.getTime())

      periods.push({
        label: `${formatShortDate(rangeStart)}-${rangeEnd.getDate()}`,
        start: getLocalDateString(rangeStart),
        end: getLocalDateString(rangeEnd),
      })
      cursor.setDate(cursor.getDate() + 7)
    }

    return periods
  }

  const monthCount = chartPeriod === 'quarterly' ? 3 : 12
  return Array.from({ length: monthCount }, (_, index) => {
    const key = addMonthsToKey(selectedMonth, index - monthCount + 1)
    const range = getCustomMonthRange(key, startDay)
    const [year, month] = key.split('-').map(Number)
    return {
      label: new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'short' }),
      start: range.start,
      end: range.end,
    }
  })
}

function groupLatestRecurringSeries(transactions: Transaction[], predicate: (tx: Transaction) => boolean) {
  const seriesMap = new Map<string, RecurringTransaction>()

  for (const tx of transactions) {
    if (!tx.recurrence_interval || !predicate(tx)) continue

    const seriesKey = `${tx.description}|${tx.account_id}|${tx.recurrence_interval}`
    const existing = seriesMap.get(seriesKey)

    if (!existing || tx.date > existing.date) {
      seriesMap.set(seriesKey, tx as RecurringTransaction)
    }
  }

  return Array.from(seriesMap.entries()).map(([key, tx]) => ({ key, tx }))
}

function buildUpcomingBills(
  recurringSeries: RecurringSeriesItem[],
  cycleStart: Date,
  cycleEnd: Date,
  floor: Date,
  isCurrentMonth: boolean,
  today: Date,
) {
  const bills: UpcomingBill[] = []

  for (const { key, tx } of recurringSeries) {
    const nextDue = computeNextDueDate(tx.date, tx.recurrence_interval, floor)

    if (nextDue > cycleEnd) continue
    if (nextDue < cycleStart) continue
    if (tx.recurrence_end_date && nextDue > createDateAtLocalMidnight(tx.recurrence_end_date)) continue

    bills.push({
      key,
      source: 'recurring',
      title: tx.description,
      icon: tx.category?.icon ?? null,
      color: tx.category?.color ?? '#6b7280',
      amount: tx.amount,
      currency: tx.currency,
      detail: tx.recurrence_interval,
      nextDue,
      daysUntil: isCurrentMonth ? Math.round((nextDue.getTime() - today.getTime()) / 86400000) : null,
      payment: null,
    })
  }

  return bills.sort((a, b) => a.nextDue.getTime() - b.nextDue.getTime())
}

export function useDashboardData({
  accounts,
  categories,
  transactions,
  loanPurchases,
  loanAllocations,
  chartPeriod,
  selectedMonth,
  startDay,
  baseCurrency,
  convert,
  rateTable = null,
}: {
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  loanPurchases: LoanPurchase[]
  loanAllocations: LoanPaymentAllocation[]
  chartPeriod: DashboardChartPeriod
  selectedMonth: string
  startDay: number
  baseCurrency: string
  /** Converts an amount in another currency into `baseCurrency`, or null when no rate does (LED-136). */
  convert?: ConvertFn
  /** The raw rate table income/expense totals convert with (LED-182); a transaction's own recorded rate wins over it. */
  rateTable?: RateTable | null
}) {
  const { start: monthStart, end: monthEnd } = useMemo(
    () => getCustomMonthRange(selectedMonth, startDay),
    [selectedMonth, startDay]
  )

  const isCurrentMonth = selectedMonth === getCurrentCycleMonthKey(startDay)
  // Rows dated after today are scheduled: listed, but kept out of the totals until their date (LED-238).
  const today = getLocalDateString()

  const monthTransactions = useMemo(
    () => transactions.filter((tx) => tx.date >= monthStart && tx.date <= monthEnd),
    [transactions, monthStart, monthEnd]
  )

  const categoryIdByName = useMemo(
    () => new Map(categories.map((category) => [category.name, category.id])),
    [categories]
  )

  const monthTransactionGroups = useMemo(() => {
    const income: Transaction[] = []
    const expenses: Transaction[] = []
    const expenseByCategory = new Map<string, Transaction[]>()
    const scheduledIncome: Transaction[] = []
    const scheduledExpenses: Transaction[] = []

    for (const tx of monthTransactions) {
      if (!countsYet(tx.date, today)) {
        if (tx.type === 'income') scheduledIncome.push(tx)
        else if (tx.type === 'expense') scheduledExpenses.push(tx)
        continue
      }
      if (tx.type === 'income') {
        income.push(tx)
        continue
      }

      if (tx.type === 'expense') {
        expenses.push(tx)
        const categoryKey = tx.category_id ?? '__uncategorized__'
        const existing = expenseByCategory.get(categoryKey)
        if (existing) {
          existing.push(tx)
        } else {
          expenseByCategory.set(categoryKey, [tx])
        }
      }
    }

    return {
      income,
      expenses,
      expenseByCategory,
      scheduledIncome,
      scheduledExpenses,
    }
  }, [monthTransactions, today])

  const stats = useMemo<DashboardStatsSummary>(() => {
    const balanceSummary = summarizeBalances(accounts, baseCurrency, convert)
    const incomeResult = sumConverted(monthTransactionGroups.income, baseCurrency, rateTable)
    const expensesResult = sumConverted(monthTransactionGroups.expenses, baseCurrency, rateTable)
    const upcomingIncomeResult = sumConverted(monthTransactionGroups.scheduledIncome, baseCurrency, rateTable)
    const upcomingExpensesResult = sumConverted(monthTransactionGroups.scheduledExpenses, baseCurrency, rateTable)
    const excludedFlowCurrencies = [...new Set([
      ...incomeResult.excludedCurrencies,
      ...expensesResult.excludedCurrencies,
      ...upcomingIncomeResult.excludedCurrencies,
      ...upcomingExpensesResult.excludedCurrencies,
    ])].sort()

    return {
      totalBalance: balanceSummary.netWorth,
      ...balanceSummary,
      income: incomeResult.total,
      expenses: expensesResult.total,
      net: incomeResult.total - expensesResult.total,
      upcomingIncome: upcomingIncomeResult.total,
      upcomingExpenses: upcomingExpensesResult.total,
      excludedFlowCurrencies,
      scheduledNetWorth: scheduledNetWorth(accounts, transactions, today, baseCurrency, convert),
    }
  }, [accounts, transactions, today, baseCurrency, convert, rateTable, monthTransactionGroups])

  const { cashFlowData, excludedCashFlowCurrencies } = useMemo(() => {
    const periods = getCashFlowPeriods(chartPeriod, selectedMonth, monthStart, monthEnd, startDay)
    const excluded = new Set<string>()

    const cashFlowData = periods.map(({ label, start, end }) => {
      const counted = countedEnd(end, today)
      const periodTx = transactions.filter((tx) => tx.date >= start && tx.date <= counted)
      const incomeResult = sumConverted(periodTx.filter((tx) => tx.type === 'income'), baseCurrency, rateTable)
      const expensesResult = sumConverted(periodTx.filter((tx) => tx.type === 'expense'), baseCurrency, rateTable)
      for (const code of [...incomeResult.excludedCurrencies, ...expensesResult.excludedCurrencies]) excluded.add(code)

      return {
        label,
        income: incomeResult.total,
        expenses: expensesResult.total,
      }
    })

    return { cashFlowData, excludedCashFlowCurrencies: [...excluded].sort() }
  }, [transactions, chartPeriod, selectedMonth, monthStart, monthEnd, startDay, baseCurrency, rateTable, today])

  const monthIncomeTx = useMemo(
    () => monthTransactionGroups.income,
    [monthTransactionGroups]
  )

  const monthExpenseTx = useMemo(
    () => monthTransactionGroups.expenses,
    [monthTransactionGroups]
  )

  // Uncapped: the pie card ranks and rolls the tail into Other itself above 12 categories (LED-149).
  // The currencies it leaves out for having no rate are named on the card itself (LED-224).
  const { rows: expensesByCategory, excludedCurrencies: expensesByCategoryExcluded } = useMemo(
    () => groupExpensesByCategory(transactions, categories, monthStart, countedEnd(monthEnd, today), Infinity, baseCurrency, rateTable),
    [transactions, categories, monthStart, monthEnd, baseCurrency, rateTable, today]
  )

  const recentTx = useMemo(() => monthTransactions.slice(0, 5), [monthTransactions])

  const expenseCategoryDetails = useMemo<DashboardExpenseCategoryDetail[]>(() => {
    return expensesByCategory.map((breakdown) => {
      const categoryId = categoryIdByName.get(breakdown.name) ?? null
      const categoryTransactions = monthTransactionGroups.expenseByCategory.get(categoryId ?? '__uncategorized__') ?? []
      const percentage = stats.expenses > 0 ? (breakdown.amount / stats.expenses) * 100 : 0

      return {
        ...breakdown,
        categoryId,
        percentage,
        transactions: categoryTransactions,
      }
    })
  }, [categoryIdByName, expensesByCategory, monthTransactionGroups, stats.expenses])

  const upcomingBills = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const cycleStart = createDateAtLocalMidnight(monthStart)
    const cycleEnd = createDateAtLocalMidnight(monthEnd)
    const floor = isCurrentMonth ? today : cycleStart
    const loanAccountIds = new Set(accounts.filter((account) => account.type === 'loan').map((account) => account.id))
    const recurringExpenses = groupLatestRecurringSeries(
      transactions,
      (tx) => tx.type === 'expense' && tx.is_recurring && !loanAccountIds.has(tx.to_account_id ?? '')
    )
    const recurringBills = buildUpcomingBills(recurringExpenses, cycleStart, cycleEnd, floor, isCurrentMonth, today)
    const loanBills = buildUpcomingLoanBills(
      accounts,
      loanPurchases,
      loanAllocations,
      cycleStart,
      cycleEnd,
      isCurrentMonth,
      today,
    )

    return [...recurringBills, ...loanBills].sort((left, right) => left.nextDue.getTime() - right.nextDue.getTime())
  }, [accounts, transactions, loanPurchases, loanAllocations, monthStart, monthEnd, isCurrentMonth])

  const cashFlowForecast = useMemo<DashboardCashFlowForecast>(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const cycleStart = createDateAtLocalMidnight(monthStart)
    const cycleEnd = createDateAtLocalMidnight(monthEnd)
    const floor = isCurrentMonth
      ? (() => {
          const tomorrow = new Date(today)
          tomorrow.setDate(tomorrow.getDate() + 1)
          return tomorrow
        })()
      : cycleStart

    const recurringSeries = groupLatestRecurringSeries(
      transactions,
      (tx) => tx.is_recurring && (tx.type === 'income' || tx.type === 'expense')
    )

    // The balance is already in the base currency, so each occurrence converts into it (LED-310).
    return buildCashFlowForecast({
      series: recurringSeries.map(({ tx }) => tx),
      cycleStart,
      cycleEnd,
      floor,
      currentBalance: stats.totalBalance,
      baseCurrency,
      table: rateTable,
    })
  }, [transactions, monthStart, monthEnd, isCurrentMonth, stats.totalBalance, baseCurrency, rateTable])

  const creditCards = useMemo(
    () => accounts.filter((account) => account.type === 'credit_card'),
    [accounts]
  )

  const creditCardsWithState = useMemo<CreditCardWithState[]>(
    () =>
      creditCards.map((account) => {
        const spending = getCreditCardSpending(account)
        const utilizationPct = getCreditUtilizationPct(account)
        const targetPct = account.utilization_target_pct ?? 30
        const statementCountdown = daysUntilDayOfMonth(account.statement_day)
        const dueCountdown = daysUntilDayOfMonth(account.due_day)
        const amountToPay = account.statement_balance ?? 0
        const paidAmount = account.statement_paid_amount ?? 0
        const remainingToPay = Math.max(amountToPay - paidAmount, 0)
        const reminderDays = account.payment_reminder_days ?? 3

        return {
          acc: account,
          spending,
          utilizationPct,
          targetPct,
          statementCountdown,
          dueCountdown,
          amountToPay,
          paidAmount,
          remainingToPay,
          paymentReminder: dueCountdown !== null && dueCountdown <= reminderDays && remainingToPay > 0,
          statementReminder: statementCountdown !== null && statementCountdown <= 2,
          nearLimit: utilizationPct >= targetPct,
        }
      }),
    [creditCards]
  )

  return {
    monthStart,
    monthEnd,
    isCurrentMonth,
    stats,
    cashFlowData,
    excludedCashFlowCurrencies,
    monthIncomeTx,
    monthExpenseTx,
    expensesByCategory,
    expensesByCategoryExcluded,
    expenseCategoryDetails,
    recentTx,
    upcomingBills,
    cashFlowForecast,
    creditCards,
    creditCardsWithState,
  }
}
