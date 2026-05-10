import { useMemo } from 'react'
import {
  getCurrentMonthDays,
  getCurrentWeekDays,
  getCurrentCycleMonthKey,
  getCustomMonthRange,
  getLast5Years,
  getLast8Quarters,
  groupExpensesByCategory,
} from '@/lib/utils'
import { addRecurringInterval, computeNextDueDate } from '@/lib/recurringTransactions'
import {
  getBalanceSummary,
  getCreditCardSpending,
  getCreditUtilizationPct,
  daysUntilDayOfMonth,
} from '@/lib/creditCards'
import type { Account, Category, Transaction } from '@/types'

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
  income: number
  expenses: number
  net: number
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
  tx: RecurringTransaction
  nextDue: Date
  daysUntil: number | null
}

export type CashFlowForecastItem = {
  tx: RecurringTransaction
  occurrences: number
  total: number
}

export type DashboardCashFlowForecast = {
  projectedIncome: number
  projectedExpenses: number
  projectedBalance: number
  forecastItems: CashFlowForecastItem[]
}

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

function sumTransactionsByType(transactions: Transaction[], type: Transaction['type']) {
  return transactions.filter((tx) => tx.type === type).reduce((sum, tx) => sum + tx.amount, 0)
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
      tx,
      nextDue,
      daysUntil: isCurrentMonth ? Math.round((nextDue.getTime() - today.getTime()) / 86400000) : null,
    })
  }

  return bills.sort((a, b) => a.nextDue.getTime() - b.nextDue.getTime())
}

function buildCashFlowForecast(
  recurringSeries: RecurringSeriesItem[],
  cycleStart: Date,
  cycleEnd: Date,
  floor: Date,
  currentBalance: number,
): DashboardCashFlowForecast {
  let projectedIncome = 0
  let projectedExpenses = 0
  const forecastItems: CashFlowForecastItem[] = []

  for (const { tx } of recurringSeries) {
    let dateCursor = computeNextDueDate(tx.date, tx.recurrence_interval, floor)
    let occurrences = 0

    while (dateCursor <= cycleEnd) {
      if (dateCursor >= cycleStart) {
        if (!tx.recurrence_end_date || dateCursor <= createDateAtLocalMidnight(tx.recurrence_end_date)) {
          occurrences++
        }
      }
      dateCursor = addRecurringInterval(dateCursor, tx.recurrence_interval)
    }

    if (occurrences === 0) continue

    const total = occurrences * tx.amount
    if (tx.type === 'income') projectedIncome += total
    else projectedExpenses += total

    forecastItems.push({ tx, occurrences, total })
  }

  forecastItems.sort((a, b) => b.total - a.total)

  return {
    projectedIncome,
    projectedExpenses,
    projectedBalance: currentBalance + projectedIncome - projectedExpenses,
    forecastItems,
  }
}

export function useDashboardData({
  accounts,
  categories,
  transactions,
  chartPeriod,
  selectedMonth,
  startDay,
}: {
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  chartPeriod: DashboardChartPeriod
  selectedMonth: string
  startDay: number
}) {
  const { start: monthStart, end: monthEnd } = useMemo(
    () => getCustomMonthRange(selectedMonth, startDay),
    [selectedMonth, startDay]
  )

  const isCurrentMonth = selectedMonth === getCurrentCycleMonthKey(startDay)

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

    for (const tx of monthTransactions) {
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
    }
  }, [monthTransactions])

  const stats = useMemo<DashboardStatsSummary>(() => {
    const balanceSummary = getBalanceSummary(accounts)
    const income = sumTransactionsByType(monthTransactions, 'income')
    const expenses = sumTransactionsByType(monthTransactions, 'expense')

    return {
      totalBalance: balanceSummary.netWorth,
      ...balanceSummary,
      income,
      expenses,
      net: income - expenses,
    }
  }, [accounts, monthTransactions])

  const cashFlowData = useMemo<DashboardCashFlowPoint[]>(() => {
    const periods =
      chartPeriod === 'week'
        ? getCurrentWeekDays()
        : chartPeriod === 'month'
          ? getCurrentMonthDays()
          : chartPeriod === 'quarterly'
            ? getLast8Quarters()
            : getLast5Years()

    return periods.map(({ label, start, end }) => {
      let income = 0
      let expenses = 0

      for (const tx of transactions) {
        if (tx.date < start || tx.date > end) continue
        if (tx.type === 'income') income += tx.amount
        else if (tx.type === 'expense') expenses += tx.amount
      }

      return {
        label,
        income,
        expenses,
      }
    })
  }, [transactions, chartPeriod])

  const monthIncomeTx = useMemo(
    () => monthTransactionGroups.income,
    [monthTransactionGroups]
  )

  const monthExpenseTx = useMemo(
    () => monthTransactionGroups.expenses,
    [monthTransactionGroups]
  )

  const expensesByCategory = useMemo<DashboardExpenseCategoryBreakdown[]>(
    () => groupExpensesByCategory(transactions, categories, monthStart, monthEnd),
    [transactions, categories, monthStart, monthEnd]
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
    const recurringExpenses = groupLatestRecurringSeries(
      transactions,
      (tx) => tx.type === 'expense' && tx.is_recurring
    )

    return buildUpcomingBills(recurringExpenses, cycleStart, cycleEnd, floor, isCurrentMonth, today)
  }, [transactions, monthStart, monthEnd, isCurrentMonth])

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

    return buildCashFlowForecast(recurringSeries, cycleStart, cycleEnd, floor, stats.totalBalance)
  }, [transactions, monthStart, monthEnd, isCurrentMonth, stats.totalBalance])

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
    monthIncomeTx,
    monthExpenseTx,
    expensesByCategory,
    expenseCategoryDetails,
    recentTx,
    upcomingBills,
    cashFlowForecast,
    creditCards,
    creditCardsWithState,
  }
}
