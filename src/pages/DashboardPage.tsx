import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Plus,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useAccounts } from '@/hooks/useAccounts'
import { useTransactions } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { useBudgets } from '@/hooks/useBudgets'
import { useDashboardData, type DashboardChartPeriod } from '@/hooks/useDashboardData'
import { DEFAULT_WIDGET_ORDER, useDashboardPrefs, type DashboardWidgetKey } from '@/hooks/useDashboardPrefs'
import { useSpendingAlerts } from '@/hooks/useSpendingAlerts'
import { usePreferences } from '@/hooks/usePreferences'
import { useFlipReorder } from '@/hooks/useFlipReorder'
import { formatCurrency, getCurrencySymbol, getCurrentCycleMonthKey, cn } from '@/lib/utils'
import { useMonthCycle } from '@/hooks/useMonthCycle'
import { EMERALD, CORAL, GOLD } from '@/constants/colors'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { DashboardDetailDialogs, type DashboardDetailView } from '@/components/dashboard/DashboardDetailDialogs'
import { DashboardWidgetSettingsSheet } from '@/components/dashboard/DashboardWidgetSettingsSheet'
import { DashboardCreditCardMonitor } from '@/components/dashboard/DashboardCreditCardMonitor'
import { DashboardCashFlowChart } from '@/components/dashboard/DashboardCashFlowChart'
import { DashboardCategoryPieCard } from '@/components/dashboard/DashboardCategoryPieCard'
import { DashboardRecentTransactionsCard } from '@/components/dashboard/DashboardRecentTransactionsCard'
import { DashboardBudgetProgressCard } from '@/components/dashboard/DashboardBudgetProgressCard'
import { DashboardUpcomingBillsCard } from '@/components/dashboard/DashboardUpcomingBillsCard'
import { DashboardCashFlowForecastCard } from '@/components/dashboard/DashboardCashFlowForecastCard'
import { getCreditCardSpending } from '@/lib/creditCards'
import type { AppLayoutContext } from '@/components/layout/AppLayout'

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
      onMouseEnter={(event) => {
        event.currentTarget.style.boxShadow = '0 4px 24px oklch(0 0 0 / 25%)'
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div
        className="absolute top-0 right-0 w-20 h-20 rounded-full -translate-y-1/2 translate-x-1/2 opacity-[0.07] pointer-events-none"
        style={{ background: accentColor }}
      />

      <div className="flex items-start justify-between mb-4">
        <p className="text-[0.6875rem] font-medium text-muted-foreground uppercase tracking-widest">{title}</p>
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-md flex items-center justify-center bg-muted border border-border">
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
  const date = new Date(year, month - 1 + delta, 1)
  return getMonthKey(date)
}

export default function DashboardPage() {
  const { openAddTransactionModal } = useOutletContext<AppLayoutContext>()
  const { profile } = useAuth()
  const currency = profile?.default_currency ?? 'USD'
  const currencySymbol = getCurrencySymbol(currency)
  const { accounts, loading: accountsLoading, updateAccount } = useAccounts()
  const { transactions, loading: txLoading } = useTransactions()
  const { categories } = useCategories()
  const { budgets } = useBudgets()
  const { startDay } = useMonthCycle()
  const [chartPeriod, setChartPeriod] = useState<DashboardChartPeriod>('month')
  const [detailView, setDetailView] = useState<DashboardDetailView>(null)
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentCycleMonthKey(startDay))

  const {
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
  } = useDashboardData({
    accounts,
    categories,
    transactions,
    chartPeriod,
    selectedMonth,
    startDay,
  })

  const monthLabel = formatMonthLabel(selectedMonth)
  const loading = accountsLoading || txLoading
  const { widgets, widgetOrder, toggle, moveWidget, reorderWidget } = useDashboardPrefs()
  const { prefs } = usePreferences()
  const alerts = useSpendingAlerts(budgets, transactions, prefs.largeTransactionThreshold)
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())
  const [draggedWidget, setDraggedWidget] = useState<DashboardWidgetKey | null>(null)
  const [dropTargetWidget, setDropTargetWidget] = useState<DashboardWidgetKey | null>(null)
  const [isDesktopDrag, setIsDesktopDrag] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true
  )

  const visibleAlerts = alerts.filter((alert) => !dismissedAlerts.has(alert.id))
  const orderedWidgetControls = widgetOrder.filter((key) => DEFAULT_WIDGET_ORDER.includes(key))
  const setWidgetControlRef = useFlipReorder(orderedWidgetControls)

  const widgetGridStyle = (key: DashboardWidgetKey) => {
    const index = widgetOrder.indexOf(key)
    return { order: 10 + (index === -1 ? DEFAULT_WIDGET_ORDER.length : index) }
  }

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)')
    const handleChange = () => {
      setIsDesktopDrag(mediaQuery.matches)
      if (!mediaQuery.matches) {
        setDraggedWidget(null)
        setDropTargetWidget(null)
      }
    }

    handleChange()
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    if (!navigator.onLine || creditCards.length === 0) return

    const today = new Date()
    const day = today.getDate()

    const lockStatementBalances = async () => {
      for (const creditCard of creditCards) {
        if (!creditCard.statement_day || day < creditCard.statement_day) continue

        const lockMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
        const alreadyLockedThisMonth = creditCard.statement_balance_locked_at?.startsWith(lockMonthKey)
        if (alreadyLockedThisMonth) continue

        const spending = getCreditCardSpending(creditCard)
        await updateAccount(creditCard.id, {
          statement_balance: spending,
          statement_paid_amount: 0,
          statement_balance_locked_at: today.toISOString().split('T')[0],
        })
      }
    }

    void lockStatementBalances()
  }, [creditCards, updateAccount])

  return (
    <div className="p-4 md:p-6 grid gap-6 lg:grid-cols-2 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap lg:col-span-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight truncate">
            {profile?.full_name ? `Good day, ${profile.full_name.split(' ')[0]}.` : 'Dashboard'}
          </h1>
          <p className="text-muted-foreground text-[0.8125rem] mt-0.5">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
        <DashboardWidgetSettingsSheet
          widgetOrder={widgetOrder}
          widgets={widgets}
          isDesktopDrag={isDesktopDrag}
          draggedWidget={draggedWidget}
          dropTargetWidget={dropTargetWidget}
          setDraggedWidget={setDraggedWidget}
          setDropTargetWidget={setDropTargetWidget}
          moveWidget={moveWidget}
          reorderWidget={reorderWidget}
          toggleWidget={toggle}
          setWidgetControlRef={setWidgetControlRef}
        />
      </div>

      <div
        className="h-px lg:col-span-2"
        style={{ background: 'linear-gradient(90deg, color-mix(in srgb, var(--primary) 35%, transparent), transparent)' }}
      />

      {visibleAlerts.length > 0 && (
        <div className="space-y-2 lg:col-span-2">
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
              <button type="button" onClick={() => setDismissedAlerts((state) => new Set([...state, alert.id]))}>
                <X className="w-3.5 h-3.5 opacity-60 hover:opacity-100" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 lg:col-span-2">
        <div className="flex items-center gap-1 bg-muted/40 rounded-xl px-2 py-1.5 flex-1">
          <Button variant="ghost" size="icon" onClick={() => setSelectedMonth((month) => addMonths(month, -1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-semibold flex-1 text-center">{monthLabel}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedMonth((month) => addMonths(month, 1))}
            disabled={isCurrentMonth}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <Button
          className="hidden md:inline-flex gap-1.5 h-9 text-[0.8125rem] font-medium shrink-0"
          onClick={openAddTransactionModal}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Transaction
        </Button>
      </div>

      {widgets.stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:col-span-2" style={widgetGridStyle('stats')}>
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
        <DashboardCreditCardMonitor
          creditCards={creditCardsWithState}
          style={widgetGridStyle('creditCards')}
        />
      )}

      {widgets.cashflowChart && (
        <DashboardCashFlowChart
          chartPeriod={chartPeriod}
          setChartPeriod={setChartPeriod}
          cashFlowData={cashFlowData}
          currency={currency}
          currencySymbol={currencySymbol}
          loading={loading}
          style={widgetGridStyle('cashflowChart')}
        />
      )}

      <div className="contents">
        {widgets.categoryPie && (
          <DashboardCategoryPieCard
            expensesByCategory={expensesByCategory}
            monthLabel={monthLabel}
            currency={currency}
            loading={loading}
            onClick={() => setDetailView('categories')}
            style={widgetGridStyle('categoryPie')}
          />
        )}

        {widgets.recentTransactions && (
          <DashboardRecentTransactionsCard
            recentTransactions={recentTx}
            isCurrentMonth={isCurrentMonth}
            monthLabel={monthLabel}
            loading={loading}
            style={widgetGridStyle('recentTransactions')}
          />
        )}
      </div>

      <div className="contents">
        {widgets.budgets && budgets.length > 0 && (
          <DashboardBudgetProgressCard
            budgets={budgets}
            monthLabel={monthLabel}
            style={widgetGridStyle('budgets')}
          />
        )}
      </div>

      <div className="contents">
        {widgets.upcomingBills && (
          <DashboardUpcomingBillsCard
            bills={upcomingBills}
            isCurrentMonth={isCurrentMonth}
            monthLabel={monthLabel}
            loading={loading}
            style={widgetGridStyle('upcomingBills')}
          />
        )}

        {widgets.cashflowForecast && (
          <DashboardCashFlowForecastCard
            forecast={cashFlowForecast}
            currentBalance={stats.totalBalance}
            currency={currency}
            isCurrentMonth={isCurrentMonth}
            monthLabel={monthLabel}
            loading={loading}
            style={widgetGridStyle('cashflowForecast')}
          />
        )}
      </div>

      <DashboardDetailDialogs
        detailView={detailView}
        setDetailView={setDetailView}
        accounts={accounts}
        monthLabel={monthLabel}
        monthIncomeTx={monthIncomeTx}
        monthExpenseTx={monthExpenseTx}
        expenseCategoryDetails={expenseCategoryDetails}
        stats={stats}
        currency={currency}
      />
    </div>
  )
}
