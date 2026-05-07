import { useEffect, useMemo, useState } from 'react'
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, Wallet, ArrowLeftRight, Plus, ChevronRight, ChevronLeft, Bell, BarChart3, ArrowRight, Settings2, AlertTriangle, X, CreditCard, CalendarClock } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useAccounts } from '@/hooks/useAccounts'
import { useTransactions } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { useBudgets } from '@/hooks/useBudgets'
import { useDashboardPrefs } from '@/hooks/useDashboardPrefs'
import { useSpendingAlerts } from '@/hooks/useSpendingAlerts'
import { usePreferences } from '@/hooks/usePreferences'
import { formatCurrency, getCurrencySymbol, getLast8Quarters, getCurrentWeekDays, getCurrentMonthDays, getLast5Years, getCustomMonthRange, getCurrentCycleMonthKey, groupExpensesByCategory, cn } from '@/lib/utils'
import { useMonthCycle } from '@/hooks/useMonthCycle'
import { BUDGET_WARNING_THRESHOLD } from '@/constants/accounts'
import { EMERALD, CORAL, GOLD } from '@/constants/colors'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { getAccountNetWorthContribution, getBalanceSummary, getCreditCardSpending, getCreditUtilizationPct, daysUntilDayOfMonth } from '@/lib/creditCards'
import type { AppLayoutContext } from '@/components/layout/AppLayout'

const CHART_TOOLTIP_STYLE = {
  backgroundColor: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  fontSize: '12px',
  color: 'var(--foreground)',
  boxShadow: '0 8px 32px oklch(0 0 0 / 25%)',
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  trend,
  loading,
  variant = 'default',
  onClick,
  className,
}: {
  title: string
  value: string
  sub?: string
  icon: React.ElementType
  trend?: 'up' | 'down' | 'neutral'
  loading?: boolean
  variant?: 'balance' | 'income' | 'expense' | 'default'
  onClick?: () => void
  className?: string
}) {
  const accentColor =
    variant === 'income' ? EMERALD
    : variant === 'expense' ? CORAL
    : GOLD

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border/60 p-5 transition-all duration-300 group bg-card hover-lift press-scale',
        onClick && 'cursor-pointer select-none',
        className
      )}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 4px 24px oklch(0 0 0 / 25%)`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Accent corner glow */}
      <div
        className="absolute top-0 right-0 w-20 h-20 rounded-full -translate-y-1/2 translate-x-1/2 opacity-[0.07] pointer-events-none"
        style={{ background: accentColor }}
      />

      <div className="flex items-start justify-between mb-4">
        <p className="text-[0.6875rem] font-medium text-muted-foreground uppercase tracking-widest">{title}</p>
        <div className="flex items-center gap-1.5">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center bg-muted border border-border"
          >
            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          {onClick && (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
          )}
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-9 w-32" />
      ) : (
        <>
          <p
            className={cn(
              'text-[1.75rem] font-bold leading-none mb-2',
              variant === 'balance' ? 'balance-gradient' : 'money'
            )}
            style={variant !== 'balance' ? { color: accentColor } : undefined}
          >
            {value}
          </p>
          {sub && (
            <p
              className="text-[0.6875rem] font-medium"
              style={{
                color: trend === 'up' ? EMERALD : trend === 'down' ? CORAL : 'oklch(0.570 0.015 290)',
              }}
            >
              {sub}
            </p>
          )}
        </>
      )}
    </div>
  )
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(key: string) {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function addMonths(key: string, delta: number) {
  const [year, month] = key.split('-').map(Number)
  const d = new Date(year, month - 1 + delta, 1)
  return getMonthKey(d)
}

// ─── Recurring-transaction helpers ───────────────────────────────────────────
function addInterval(d: Date, interval: string): Date {
  const nd = new Date(d)
  switch (interval) {
    case 'daily':     nd.setDate(nd.getDate() + 1); break
    case 'weekly':    nd.setDate(nd.getDate() + 7); break
    case 'biweekly':  nd.setDate(nd.getDate() + 14); break
    case 'monthly':   nd.setMonth(nd.getMonth() + 1); break
    case 'quarterly': nd.setMonth(nd.getMonth() + 3); break
    case 'yearly':    nd.setFullYear(nd.getFullYear() + 1); break
  }
  return nd
}

/** Returns the first occurrence of a recurring series on or after `floor`. */
function computeNextDueDate(lastDateStr: string, interval: string, floor: Date): Date {
  let d = new Date(lastDateStr + 'T00:00:00')
  d = addInterval(d, interval)
  while (d < floor) d = addInterval(d, interval)
  return d
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { openAddTransactionModal } = useOutletContext<AppLayoutContext>()
  const { profile } = useAuth()
  const currency = profile?.default_currency ?? 'USD'
  const currencySymbol = getCurrencySymbol(currency)
  const { accounts, loading: accountsLoading, updateAccount } = useAccounts()
  const { transactions, loading: txLoading } = useTransactions()
  const { categories } = useCategories()
  const { budgets } = useBudgets()
  const { startDay } = useMonthCycle()
  const [chartPeriod, setChartPeriod] = useState<'week' | 'month' | 'quarterly' | 'yearly'>('month')
  const [detailView, setDetailView] = useState<'balance' | 'income' | 'expenses' | 'categories' | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentCycleMonthKey(startDay))

  const { start: monthStart, end: monthEnd } = getCustomMonthRange(selectedMonth, startDay)
  const isCurrentMonth = selectedMonth === getCurrentCycleMonthKey(startDay)
  const monthLabel = formatMonthLabel(selectedMonth)

  // ---- Stats ----
  const stats = useMemo(() => {
    const balanceSummary = getBalanceSummary(accounts)
    const monthTx = transactions.filter((t) => t.date >= monthStart && t.date <= monthEnd)
    const income = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expenses = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return { totalBalance: balanceSummary.netWorth, ...balanceSummary, income, expenses, net: income - expenses }
  }, [accounts, transactions, monthStart, monthEnd])

  // ---- Cash flow chart data ----
  const cashFlowData = useMemo(() => {
    const periods =
      chartPeriod === 'week' ? getCurrentWeekDays()
      : chartPeriod === 'month' ? getCurrentMonthDays()
      : chartPeriod === 'quarterly' ? getLast8Quarters()
      : getLast5Years()
    return periods.map(({ label, start, end }) => {
      const periodTx = transactions.filter((t) => t.date >= start && t.date <= end)
      return {
        label,
        income: periodTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
        expenses: periodTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      }
    })
  }, [transactions, chartPeriod])

  // ---- Month income / expense transaction lists (for detail dialogs) ----
  const monthIncomeTx = useMemo(
    () => transactions.filter((t) => t.type === 'income' && t.date >= monthStart && t.date <= monthEnd),
    [transactions, monthStart, monthEnd]
  )
  const monthExpenseTx = useMemo(
    () => transactions.filter((t) => t.type === 'expense' && t.date >= monthStart && t.date <= monthEnd),
    [transactions, monthStart, monthEnd]
  )

  // ---- Expenses by category (this month) ----
  const expensesByCategory = useMemo(
    () => groupExpensesByCategory(transactions, categories, monthStart, monthEnd),
    [transactions, categories, monthStart, monthEnd],
  )

  // ---- Recent transactions (filtered to selected month) ----
  const recentTx = useMemo(
    () => transactions.filter((t) => t.date >= monthStart && t.date <= monthEnd).slice(0, 5),
    [transactions, monthStart, monthEnd]
  )

  // ---- Upcoming bills (selected billing cycle) ----
  const upcomingBills = useMemo(() => {
    const todayLocal = new Date()
    todayLocal.setHours(0, 0, 0, 0)
    const cycleStart = new Date(monthStart + 'T00:00:00')
    const cycleEnd = new Date(monthEnd + 'T00:00:00')
    // Floor: for the current cycle show from today; for past/future show full cycle
    const floor = isCurrentMonth ? todayLocal : cycleStart

    const recurringExp = transactions.filter(
      (t) => t.is_recurring && t.recurrence_interval && t.type === 'expense'
    )
    // Keep latest occurrence per series
    const seriesMap = new Map<string, typeof recurringExp[0]>()
    for (const tx of recurringExp) {
      const k = `${tx.description}|${tx.account_id}|${tx.recurrence_interval}`
      const ex = seriesMap.get(k)
      if (!ex || tx.date > ex.date) seriesMap.set(k, tx)
    }

    const bills: Array<{ key: string; tx: typeof recurringExp[0]; nextDue: Date; daysUntil: number | null }> = []
    for (const [key, tx] of seriesMap.entries()) {
      const interval = tx.recurrence_interval!
      const nextDue = computeNextDueDate(tx.date, interval, floor)
      if (nextDue > cycleEnd) continue
      if (nextDue < cycleStart) continue
      if (tx.recurrence_end_date && nextDue > new Date(tx.recurrence_end_date + 'T00:00:00')) continue
      const daysUntil = isCurrentMonth
        ? Math.round((nextDue.getTime() - todayLocal.getTime()) / 86400000)
        : null
      bills.push({ key, tx, nextDue, daysUntil })
    }
    return bills.sort((a, b) => a.nextDue.getTime() - b.nextDue.getTime())
  }, [transactions, monthStart, monthEnd, isCurrentMonth])

  // ---- Cash flow forecast (selected billing cycle) ----
  const cashFlowForecast = useMemo(() => {
    const todayLocal = new Date()
    todayLocal.setHours(0, 0, 0, 0)
    const cycleStart = new Date(monthStart + 'T00:00:00')
    const cycleEnd = new Date(monthEnd + 'T00:00:00')
    // For current month forecast remaining items from tomorrow; for other months use full cycle
    const floor = isCurrentMonth
      ? (() => { const t = new Date(todayLocal); t.setDate(t.getDate() + 1); return t })()
      : cycleStart

    const recurringTx = transactions.filter(
      (t) => t.is_recurring && t.recurrence_interval && (t.type === 'income' || t.type === 'expense')
    )
    const seriesMap = new Map<string, typeof recurringTx[0]>()
    for (const tx of recurringTx) {
      const k = `${tx.description}|${tx.account_id}|${tx.recurrence_interval}`
      const ex = seriesMap.get(k)
      if (!ex || tx.date > ex.date) seriesMap.set(k, tx)
    }

    let projectedIncome = 0
    let projectedExpenses = 0
    const forecastItems: Array<{ tx: typeof recurringTx[0]; occurrences: number; total: number }> = []
    for (const tx of seriesMap.values()) {
      const interval = tx.recurrence_interval!
      let d = computeNextDueDate(tx.date, interval, floor)
      let count = 0
      while (d <= cycleEnd) {
        if (d >= cycleStart) {
          if (!tx.recurrence_end_date || d <= new Date(tx.recurrence_end_date + 'T00:00:00')) count++
        }
        d = addInterval(d, interval)
      }
      if (count === 0) continue
      const total = count * tx.amount
      if (tx.type === 'income') projectedIncome += total
      else projectedExpenses += total
      forecastItems.push({ tx, occurrences: count, total })
    }
    forecastItems.sort((a, b) => b.total - a.total)
    return {
      projectedIncome,
      projectedExpenses,
      projectedBalance: stats.totalBalance + projectedIncome - projectedExpenses,
      forecastItems,
    }
  }, [transactions, monthStart, monthEnd, isCurrentMonth, stats.totalBalance])

  const loading = accountsLoading || txLoading

  const { widgets, toggle } = useDashboardPrefs()
  const { prefs } = usePreferences()
  const alerts = useSpendingAlerts(budgets, transactions, prefs.largeTransactionThreshold)
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())
  const visibleAlerts = alerts.filter((a) => !dismissedAlerts.has(a.id))
  const creditCards = useMemo(() => accounts.filter((a) => a.type === 'credit_card'), [accounts])

  const creditCardsWithState = useMemo(() => creditCards.map((acc) => {
    const spending = getCreditCardSpending(acc)
    const utilizationPct = getCreditUtilizationPct(acc)
    const targetPct = acc.utilization_target_pct ?? 30
    const statementCountdown = daysUntilDayOfMonth(acc.statement_day)
    const dueCountdown = daysUntilDayOfMonth(acc.due_day)
    const amountToPay = acc.statement_balance ?? 0
    const paidAmount = acc.statement_paid_amount ?? 0
    const remainingToPay = Math.max(amountToPay - paidAmount, 0)
    const reminderDays = acc.payment_reminder_days ?? 3
    const paymentReminder = dueCountdown !== null && dueCountdown <= reminderDays && remainingToPay > 0
    const statementReminder = statementCountdown !== null && statementCountdown <= 2
    return {
      acc,
      spending,
      utilizationPct,
      targetPct,
      statementCountdown,
      dueCountdown,
      amountToPay,
      paidAmount,
      remainingToPay,
      paymentReminder,
      statementReminder,
      nearLimit: utilizationPct >= targetPct,
    }
  }), [creditCards])

  useEffect(() => {
    if (!navigator.onLine || creditCards.length === 0) return

    const today = new Date()
    const day = today.getDate()
    const lockStatementBalances = async () => {
      for (const cc of creditCards) {
        if (!cc.statement_day || day < cc.statement_day) continue

        const lockMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
        const alreadyLockedThisMonth = cc.statement_balance_locked_at?.startsWith(lockMonthKey)
        if (alreadyLockedThisMonth) continue

        const spending = getCreditCardSpending(cc)
        await updateAccount(cc.id, {
          statement_balance: spending,
          statement_paid_amount: 0,
          statement_balance_locked_at: today.toISOString().split('T')[0],
        })
      }
    }

    lockStatementBalances()
  }, [creditCards, updateAccount])


  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight truncate">
            {profile?.full_name ? `Good day, ${profile.full_name.split(' ')[0]}.` : 'Dashboard'}
          </h1>
          <p className="text-muted-foreground text-[0.8125rem] mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <Sheet>
          <SheetTrigger render={<Button variant="outline" size="sm" className="gap-1.5 shrink-0" />}>
            <Settings2 className="w-3.5 h-3.5" />
            <span className="text-[0.8125rem]">Widgets</span>
          </SheetTrigger>
          <SheetContent className="w-[280px] sm:max-w-[280px]">
            <SheetHeader>
              <SheetTitle>Dashboard Widgets</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4 space-y-1">
              {([
                ['stats', 'Stats Cards'],
                ['cashflowChart', 'Cash Flow Chart'],
                ['categoryPie', 'Category Pie'],
                ['budgets', 'Budget Progress'],
                ['upcomingBills', 'Upcoming Bills'],
                ['cashflowForecast', 'Cash Flow Forecast'],
                ['creditCards', 'Credit Card Tracker'],
              ] as const).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0">
                  <span className="text-sm">{label}</span>
                  <Switch checked={widgets[key]} onCheckedChange={() => toggle(key)} />
                </div>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
      {/* Gold separator */}
      <div className="h-px" style={{ background: 'linear-gradient(90deg, color-mix(in srgb, var(--primary) 35%, transparent), transparent)' }} />

      {/* Spending alerts */}
      {visibleAlerts.length > 0 && (
        <div className="space-y-2">
          {visibleAlerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm',
                alert.type === 'budget_exceeded'
                  ? 'border-destructive/30 bg-destructive/5 text-destructive'
                  : 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400'
              )}
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="flex-1">{alert.message}</span>
              <button type="button" onClick={() => setDismissedAlerts((s) => new Set([...s, alert.id]))}>
                <X className="w-3.5 h-3.5 opacity-60 hover:opacity-100" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Month navigation */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-muted/40 rounded-xl px-2 py-1.5 flex-1">
          <Button variant="ghost" size="icon" onClick={() => setSelectedMonth((m) => addMonths(m, -1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-semibold flex-1 text-center">{monthLabel}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedMonth((m) => addMonths(m, 1))}
            disabled={isCurrentMonth}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <Button
          className="hidden md:inline-flex gap-1.5 h-9 text-[0.8125rem] font-medium shrink-0"
          onClick={openAddTransactionModal}
        >
          <Plus className="w-3.5 h-3.5" />Add Transaction
        </Button>
      </div>

      {/* Stat cards */}
      {widgets.stats && (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Net Balance"
          value={formatCurrency(stats.totalBalance, currency)}
          sub="Assets minus Liabilities"
          icon={Wallet}
          variant="balance"
          loading={loading}
          onClick={() => setDetailView('balance')}
          className="animate-fade-up"
        />
        <StatCard
          title="Monthly Income"
          value={formatCurrency(stats.income, currency)}
          className="animate-fade-up anim-delay-1"
          sub={isCurrentMonth ? 'This month' : monthLabel}
          icon={TrendingUp}
          trend="up"
          variant="income"
          loading={loading}
          onClick={() => setDetailView('income')}
        />
        <StatCard
          title="Monthly Expenses"
          value={formatCurrency(stats.expenses, currency)}
          sub={isCurrentMonth ? 'This month' : monthLabel}
          icon={TrendingDown}
          trend="down"
          variant="expense"
          loading={loading}
          onClick={() => setDetailView('expenses')}
          className="animate-fade-up anim-delay-2"
        />
        <StatCard
          title="Net Cash Flow"
          value={formatCurrency(stats.net, currency)}
          sub={stats.net >= 0 ? 'Positive flow' : 'Negative flow'}
          icon={ArrowLeftRight}
          trend={stats.net >= 0 ? 'up' : 'down'}
          loading={loading}
          className="animate-fade-up anim-delay-3"
        />
      </div>
      )}

      {widgets.creditCards && creditCards.length > 0 && (
        <div className="rounded-xl border border-border/60 p-5 bg-card space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-[0.9375rem]">Credit Card Monitor</p>
              <p className="text-xs text-muted-foreground mt-0.5">Spending, statement, and payment tracking</p>
            </div>
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-muted border border-border">
              <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-3">
            {creditCardsWithState.map((cc) => {
              return (
                <div key={cc.acc.id} className="rounded-lg border border-border/50 p-3.5 bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{cc.acc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Spent {formatCurrency(cc.spending, cc.acc.currency)} of {formatCurrency(cc.acc.credit_limit ?? 0, cc.acc.currency)}
                      </p>
                    </div>
                    <p className="text-xs font-semibold" style={{ color: cc.nearLimit ? CORAL : EMERALD }}>
                      {cc.utilizationPct.toFixed(1)}% used
                    </p>
                  </div>
                  <Progress
                    value={Math.min(cc.utilizationPct, 100)}
                    className={cc.nearLimit ? '[&>div]:bg-[oklch(0.620_0.160_18)]' : '[&>div]:bg-[oklch(0.660_0.150_155)]'}
                  />
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md border border-border/40 px-2 py-1.5">
                      <p className="text-muted-foreground">Statement</p>
                      <p className="font-medium">
                        {cc.statementCountdown == null
                          ? 'Not set'
                          : cc.statementCountdown === 0
                            ? 'Today'
                            : `in ${cc.statementCountdown} ${cc.statementCountdown === 1 ? 'day' : 'days'}`}
                      </p>
                    </div>
                    <div className="rounded-md border border-border/40 px-2 py-1.5">
                      <p className="text-muted-foreground">Due</p>
                      <p className="font-medium">
                        {cc.dueCountdown == null
                          ? 'Not set'
                          : cc.dueCountdown === 0
                            ? 'Today'
                            : `in ${cc.dueCountdown} ${cc.dueCountdown === 1 ? 'day' : 'days'}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-border/40 px-2.5 py-2 text-xs">
                    <span className="text-muted-foreground">Amount to pay</span>
                    <span className="money font-semibold">{formatCurrency(cc.amountToPay, cc.acc.currency)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-border/40 px-2.5 py-2 text-xs">
                    <span className="text-muted-foreground">Remaining</span>
                    <span className="money font-semibold" style={{ color: cc.remainingToPay > 0 ? CORAL : EMERALD }}>
                      {formatCurrency(cc.remainingToPay, cc.acc.currency)}
                    </span>
                  </div>
                  {cc.paymentReminder && (
                    <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-2 text-xs text-amber-700 dark:text-amber-400">
                      <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                      Payment reminder: due in {cc.dueCountdown} day(s)
                    </div>
                  )}
                  {cc.statementReminder && (
                    <div className="flex items-center gap-2 rounded-md border border-sky-500/30 bg-sky-500/5 px-2.5 py-2 text-xs text-sky-700 dark:text-sky-300">
                      <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                      {cc.statementCountdown === 0
                        ? 'Statement day is today'
                        : `Statement day in ${cc.statementCountdown} day(s)`}
                    </div>
                  )}
                  {cc.acc.last_payment_date && cc.acc.last_payment_amount != null && (
                    <p className="text-[0.6875rem] text-muted-foreground">
                      Last payment: {formatCurrency(cc.acc.last_payment_amount, cc.acc.currency)} on {cc.acc.last_payment_date}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Cash flow chart */}
      {widgets.cashflowChart && (
      <div
        className="rounded-xl border border-border/60 overflow-hidden bg-card"
      >
        <div className="px-5 pt-5 pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-[0.9375rem]">Cash Flow</p>
              <p className="text-xs text-muted-foreground mt-0.5">Income vs expenses over time</p>
            </div>
            <Tabs value={chartPeriod} onValueChange={(v) => setChartPeriod(v as 'week' | 'month' | 'quarterly' | 'yearly')}>
              <TabsList className="h-8 w-full sm:w-auto">
                <TabsTrigger value="week" className="text-xs flex-1 sm:flex-none px-3">This Week</TabsTrigger>
                <TabsTrigger value="month" className="text-xs flex-1 sm:flex-none px-3">This Month</TabsTrigger>
                <TabsTrigger value="quarterly" className="text-xs flex-1 sm:flex-none px-3">Quarterly</TabsTrigger>
                <TabsTrigger value="yearly" className="text-xs flex-1 sm:flex-none px-3">Yearly</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
        <div className="px-2 pb-4">
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={cashFlowData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="income-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={EMERALD} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={EMERALD} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expense-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CORAL} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={CORAL} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} interval={chartPeriod === 'month' ? 4 : 'preserveStartEnd'} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${currencySymbol}${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value) => formatCurrency(value as number, currency)}
                  contentStyle={CHART_TOOLTIP_STYLE}
                  cursor={{ stroke: 'var(--primary)', strokeWidth: 1, strokeOpacity: 0.3 }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                <Area type="monotone" dataKey="income" stroke={EMERALD} fill="url(#income-grad)" strokeWidth={2} name="Income" dot={false} />
                <Area type="monotone" dataKey="expenses" stroke={CORAL} fill="url(#expense-grad)" strokeWidth={2} name="Expenses" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Expenses by category — pie */}
        {widgets.categoryPie && (
        <div
          className="rounded-xl border border-border/60 p-5 bg-card cursor-pointer transition-shadow duration-300 hover:shadow-[0_4px_24px_oklch(0_0_0/25%)]"
          onClick={() => setDetailView('categories')}
        >
          <div className="flex items-start justify-between mb-0.5">
            <p className="font-semibold text-[0.9375rem]">Expenses by Category</p>
            <ChevronRight className="w-4 h-4 text-muted-foreground/50 mt-0.5" />
          </div>
          <p className="text-xs text-muted-foreground mb-4">{monthLabel} spending breakdown</p>
          {loading ? (
            <Skeleton className="h-56 w-full" />
          ) : expensesByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">No expenses for {monthLabel}</p>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex justify-center sm:block sm:w-[50%]">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={expensesByCategory}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={78}
                      strokeWidth={2}
                      stroke="var(--card)"
                    >
                      {expensesByCategory.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => formatCurrency(v as number, currency)}
                      contentStyle={CHART_TOOLTIP_STYLE}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1.5 min-w-0">
                {expensesByCategory.map((cat, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-base">{cat.icon}</span>
                    <span className="truncate flex-1 text-xs text-muted-foreground">{cat.name}</span>
                    <span className="money text-xs font-medium shrink-0" style={{ color: cat.color }}>{formatCurrency(cat.amount, currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        )}

        {/* Recent transactions */}
        <div
          className="rounded-xl border border-border/60 p-5 bg-card"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-semibold text-[0.9375rem]">Recent Transactions</p>
              <p className="text-xs text-muted-foreground mt-0.5">{isCurrentMonth ? 'Latest activity' : monthLabel}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/transactions')}
              className="text-xs text-muted-foreground hover:text-primary h-7 px-2"
            >
              View all
            </Button>
          </div>
          {loading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
          ) : recentTx.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No transactions yet</p>
          ) : (
            <div className="space-y-0.5">
              {recentTx.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 py-2.5 px-2 rounded-lg transition-colors hover:bg-white/3"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                    style={{ backgroundColor: (tx.category?.color ?? '#6b7280') + '22' }}
                  >
                    {tx.category?.icon ?? '💸'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.8125rem] font-medium truncate text-foreground/90">{tx.description}</p>
                    <p className="text-[0.6875rem] text-muted-foreground">{tx.date}</p>
                  </div>
                  <p
                    className="money text-[0.8125rem] font-semibold shrink-0"
                    style={{
                      color: tx.type === 'income' ? EMERALD : tx.type === 'expense' ? CORAL : GOLD,
                    }}
                  >
                    {tx.type === 'income' ? '+' : tx.type === 'expense' ? '−' : ''}
                    {formatCurrency(tx.amount, tx.currency)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Budget progress */}
        {widgets.budgets && budgets.length > 0 && (
          <div
            className="rounded-xl border border-border/60 p-5 bg-card"
          >
            <p className="font-semibold text-[0.9375rem] mb-0.5">Budget Progress</p>
            <p className="text-xs text-muted-foreground mb-4">Spending vs budget limits · {monthLabel}</p>
            <div className="space-y-4">
              {budgets.slice(0, 4).map((b) => {
                const spent = b.spent ?? 0
                const pct = Math.min((spent / b.amount) * 100, 100)
                const over = spent > b.amount
                return (
                  <div key={b.id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[0.8125rem]">
                        <span>{b.category?.icon}</span>
                        <span className="text-foreground/80">{b.name}</span>
                      </span>
                      <span
                        className="money text-xs"
                        style={{ color: over ? CORAL : pct > BUDGET_WARNING_THRESHOLD ? 'oklch(0.750 0.140 75)' : 'oklch(0.570 0.015 290)' }}
                      >
                        {formatCurrency(spent, b.currency)} / {formatCurrency(b.amount, b.currency)}
                      </span>
                    </div>
                    <Progress
                      value={pct}
                      className={over ? '[&>div]:bg-[oklch(0.620_0.160_18)]' : pct > BUDGET_WARNING_THRESHOLD ? '[&>div]:bg-[oklch(0.750_0.140_75)]' : '[&>div]:bg-primary'}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>

      {/* ─── Upcoming Bills + Cash Flow Forecast ──────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Upcoming Bills */}
        {widgets.upcomingBills && (
        <div className="rounded-xl border border-border/60 p-5 bg-card">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="font-semibold text-[0.9375rem]">Upcoming Bills</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isCurrentMonth ? 'Recurring expenses this cycle' : `Recurring expenses · ${monthLabel}`}
              </p>
            </div>
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-muted border border-border">
              <Bell className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </div>
          {loading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : upcomingBills.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No upcoming bills this cycle</p>
          ) : (
            <div className="space-y-0.5">
              {upcomingBills.slice(0, 6).map(({ key, tx, nextDue, daysUntil }) => (
                <div key={key} className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-white/3 transition-colors">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                    style={{ backgroundColor: (tx.category?.color ?? '#6b7280') + '22' }}
                  >
                    {tx.category?.icon ?? '📅'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.8125rem] font-medium truncate text-foreground/90">{tx.description}</p>
                    <p className="text-[0.6875rem] text-muted-foreground">
                      {nextDue.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {tx.recurrence_interval && (
                        <span className="ml-1.5 capitalize opacity-60">· {tx.recurrence_interval}</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="money text-[0.8125rem] font-semibold" style={{ color: CORAL }}>
                      −{formatCurrency(tx.amount, tx.currency)}
                    </p>
                    {daysUntil !== null && (
                      <p
                        className="text-[0.625rem] font-medium"
                        style={{
                          color:
                            daysUntil === 0 ? CORAL
                            : daysUntil <= 3 ? 'oklch(0.750 0.140 75)'
                            : 'oklch(0.570 0.015 290)',
                        }}
                      >
                        {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `in ${daysUntil}d`}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Cash Flow Forecast */}
        {widgets.cashflowForecast && (
        <div className="rounded-xl border border-border/60 p-5 bg-card">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="font-semibold text-[0.9375rem]">Cash Flow Forecast</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isCurrentMonth ? 'Projected end-of-cycle balance' : `Full cycle · ${monthLabel}`}
              </p>
            </div>
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-muted border border-border">
              <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </div>
          {loading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
          ) : (
            <div className="space-y-4">
              {/* Current → Projected balance */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 rounded-lg bg-muted/40 border border-border/40 px-3 py-2.5 text-center">
                  <p className="text-[0.625rem] text-muted-foreground uppercase tracking-wider mb-1">Current</p>
                  <p className="money text-[0.9375rem] font-bold balance-gradient">{formatCurrency(stats.totalBalance, currency)}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                <div className="flex-1 rounded-lg bg-muted/40 border border-border/40 px-3 py-2.5 text-center">
                  <p className="text-[0.625rem] text-muted-foreground uppercase tracking-wider mb-1">Projected</p>
                  <p
                    className="money text-[0.9375rem] font-bold"
                    style={{ color: cashFlowForecast.projectedBalance >= stats.totalBalance ? EMERALD : CORAL }}
                  >
                    {formatCurrency(cashFlowForecast.projectedBalance, currency)}
                  </p>
                </div>
              </div>

              {/* Income / Expense breakdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <TrendingUp className="w-3.5 h-3.5 shrink-0" style={{ color: EMERALD }} />
                    Expected income
                  </span>
                  <span className="money font-medium" style={{ color: EMERALD }}>
                    +{formatCurrency(cashFlowForecast.projectedIncome, currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <TrendingDown className="w-3.5 h-3.5 shrink-0" style={{ color: CORAL }} />
                    Expected expenses
                  </span>
                  <span className="money font-medium" style={{ color: CORAL }}>
                    −{formatCurrency(cashFlowForecast.projectedExpenses, currency)}
                  </span>
                </div>
                <div className="h-px bg-border/40" />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Net change</span>
                  <span
                    className="money font-semibold"
                    style={{
                      color: cashFlowForecast.projectedIncome - cashFlowForecast.projectedExpenses >= 0 ? EMERALD : CORAL,
                    }}
                  >
                    {cashFlowForecast.projectedIncome - cashFlowForecast.projectedExpenses >= 0 ? '+' : ''}
                    {formatCurrency(cashFlowForecast.projectedIncome - cashFlowForecast.projectedExpenses, currency)}
                  </span>
                </div>
              </div>

              {/* Top recurring items */}
              {cashFlowForecast.forecastItems.length > 0 ? (
                <div className="pt-1 border-t border-border/30 space-y-1">
                  <p className="text-[0.625rem] text-muted-foreground uppercase tracking-wider mb-2">Recurring items</p>
                  {cashFlowForecast.forecastItems.slice(0, 4).map((item, i) => (
                    <div key={i} className="flex items-center gap-2 py-1 text-xs">
                      <span className="text-[0.8125rem] shrink-0">{item.tx.category?.icon ?? '🔄'}</span>
                      <span className="flex-1 truncate text-muted-foreground">{item.tx.description}</span>
                      {item.occurrences > 1 && (
                        <span className="text-[0.625rem] text-muted-foreground/50 shrink-0">×{item.occurrences}</span>
                      )}
                      <span
                        className="money font-medium shrink-0"
                        style={{ color: item.tx.type === 'income' ? EMERALD : CORAL }}
                      >
                        {item.tx.type === 'income' ? '+' : '−'}{formatCurrency(item.total, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  No recurring transactions found
                </p>
              )}
            </div>
          )}
        </div>
        )}

      </div>

      {/* ---- Detail Dialogs ---- */}

      {/* Net Balance detail */}
      <Dialog open={detailView === 'balance'} onOpenChange={(o) => !o && setDetailView(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Net Balance</DialogTitle>
            <p className="text-xs text-muted-foreground">Assets minus Liabilities</p>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-2 pr-2">
              {accounts.map((acc) => (
                (() => {
                  const contribution = getAccountNetWorthContribution(acc)
                  return (
                <div key={acc.id} className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2.5 bg-muted/30">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 border border-border/50"
                    style={{ backgroundColor: acc.color + '22' }}
                  >
                    {acc.icon ?? '🏦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.8125rem] font-medium truncate">{acc.name}</p>
                    <p className="text-[0.6875rem] text-muted-foreground capitalize">{acc.type.replace('_', ' ')}</p>
                  </div>
                  <p
                    className="money text-sm font-semibold shrink-0"
                    style={{ color: contribution >= 0 ? EMERALD : CORAL }}
                  >
                    {formatCurrency(contribution, acc.currency)}
                  </p>
                </div>
                  )
                })()
              ))}
              {accounts.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No accounts yet</p>
              )}
            </div>
          </ScrollArea>
          {accounts.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Assets</span>
                <span className="money text-sm font-semibold">{formatCurrency(stats.totalAssets, currency)}</span>
              </div>
              {stats.totalCreditCardDebt > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Credit card debt</span>
                  <span className="money text-sm font-semibold" style={{ color: CORAL }}>
                    -{formatCurrency(stats.totalCreditCardDebt, currency)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Net</span>
                <span className="money text-base font-bold balance-gradient">{formatCurrency(stats.totalBalance, currency)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Monthly Income detail */}
      <Dialog open={detailView === 'income'} onOpenChange={(o) => !o && setDetailView(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Income — {monthLabel}</DialogTitle>
            <p className="text-xs text-muted-foreground">{monthIncomeTx.length} transaction{monthIncomeTx.length !== 1 ? 's' : ''}</p>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-1 pr-2">
              {monthIncomeTx.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-white/3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                    style={{ backgroundColor: (tx.category?.color ?? '#6b7280') + '22' }}
                  >
                    {tx.category?.icon ?? '💰'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.8125rem] font-medium truncate">{tx.description}</p>
                    <p className="text-[0.6875rem] text-muted-foreground">{tx.category?.name ?? 'Uncategorized'} · {tx.date}</p>
                  </div>
                  <p className="money text-[0.8125rem] font-semibold shrink-0" style={{ color: EMERALD }}>
                    +{formatCurrency(tx.amount, tx.currency)}
                  </p>
                </div>
              ))}
              {monthIncomeTx.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No income this month</p>
              )}
            </div>
          </ScrollArea>
          {monthIncomeTx.length > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Income</span>
              <span className="money text-base font-bold" style={{ color: EMERALD }}>{formatCurrency(stats.income, currency)}</span>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Monthly Expenses detail */}
      <Dialog open={detailView === 'expenses'} onOpenChange={(o) => !o && setDetailView(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Expenses — {monthLabel}</DialogTitle>
            <p className="text-xs text-muted-foreground">{monthExpenseTx.length} transaction{monthExpenseTx.length !== 1 ? 's' : ''}</p>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-1 pr-2">
              {monthExpenseTx.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-white/3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                    style={{ backgroundColor: (tx.category?.color ?? '#6b7280') + '22' }}
                  >
                    {tx.category?.icon ?? '💸'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.8125rem] font-medium truncate">{tx.description}</p>
                    <p className="text-[0.6875rem] text-muted-foreground">{tx.category?.name ?? 'Uncategorized'} · {tx.date}</p>
                  </div>
                  <p className="money text-[0.8125rem] font-semibold shrink-0" style={{ color: CORAL }}>
                    −{formatCurrency(tx.amount, tx.currency)}
                  </p>
                </div>
              ))}
              {monthExpenseTx.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No expenses this month</p>
              )}
            </div>
          </ScrollArea>
          {monthExpenseTx.length > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Expenses</span>
              <span className="money text-base font-bold" style={{ color: CORAL }}>{formatCurrency(stats.expenses, currency)}</span>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Expenses by Category detail */}
      <Dialog open={detailView === 'categories'} onOpenChange={(o) => !o && setDetailView(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Expenses by Category</DialogTitle>
            <p className="text-xs text-muted-foreground">{monthLabel} spending breakdown</p>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-3 pr-2">
              {expensesByCategory.map((cat, i) => {
                const pct = stats.expenses > 0 ? (cat.amount / stats.expenses) * 100 : 0
                const catTxs = monthExpenseTx.filter((t) => {
                  const c = categories.find((c) => c.name === cat.name)
                  return c ? t.category_id === c.id : false
                })
                return (
                  <div key={i} className="rounded-lg border border-border/50 px-3 py-3 bg-muted/20 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{cat.icon}</span>
                      <span className="flex-1 text-[0.8125rem] font-medium">{cat.name}</span>
                      <span className="money text-[0.8125rem] font-semibold shrink-0" style={{ color: cat.color }}>
                        {formatCurrency(cat.amount, currency)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-border overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: cat.color }}
                      />
                    </div>
                    <p className="text-[0.6875rem] text-muted-foreground">{pct.toFixed(1)}% of total · {catTxs.length} transaction{catTxs.length !== 1 ? 's' : ''}</p>
                    {catTxs.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-border/30">
                        {catTxs.map((tx) => (
                          <div key={tx.id} className="flex items-center justify-between gap-2 py-1">
                            <p className="text-xs text-muted-foreground truncate flex-1">{tx.description}</p>
                            <p className="text-xs money font-medium shrink-0" style={{ color: CORAL }}>
                              −{formatCurrency(tx.amount, tx.currency)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              {expensesByCategory.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No expenses this month</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}
