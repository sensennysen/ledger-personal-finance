import { WidgetDragContext } from '@/contexts/widgetDragState'
import { useEffect, useState } from 'react'
import {
  AlertTriangle,
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
import { useLoanPurchases } from '@/hooks/useLoanPurchases'
import { useBudgets } from '@/hooks/useBudgets'
import { useDashboardData, type DashboardChartPeriod } from '@/hooks/useDashboardData'
import { DEFAULT_WIDGET_ORDER, useDashboardPrefs, type DashboardWidgetKey } from '@/hooks/useDashboardPrefs'
import { useSpendingAlerts } from '@/hooks/useSpendingAlerts'
import { usePreferences } from '@/hooks/usePreferences'
import { useFlipReorder } from '@/hooks/useFlipReorder'
import { formatCurrency, getCurrencySymbol, getLocalDateString, cn } from '@/lib/utils'
import { useCycle } from '@/contexts/cycleState'
import { INCOME, EXPENSE, GOLD } from '@/constants/colors'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { InlineLoadError } from '@/components/ui/error-state'
import { RefreshingRegion } from '@/components/ui/refreshing-region'
import type { Budget } from '@/types'
import { DashboardDetailDialogs, type DashboardDetailView } from '@/components/dashboard/DashboardDetailDialogs'
import { DashboardWidgetSettingsSheet } from '@/components/dashboard/DashboardWidgetSettingsSheet'
import { DashboardCreditCardMonitor } from '@/components/dashboard/DashboardCreditCardMonitor'
import { DashboardCashFlowChart } from '@/components/dashboard/DashboardCashFlowChart'
import { DashboardCategoryPieCard } from '@/components/dashboard/DashboardCategoryPieCard'
import { DashboardRecentTransactionsCard } from '@/components/dashboard/DashboardRecentTransactionsCard'
import { DashboardBudgetProgressCard } from '@/components/dashboard/DashboardBudgetProgressCard'
import { DashboardUpcomingBillsCard } from '@/components/dashboard/DashboardUpcomingBillsCard'
import { DashboardCashFlowForecastCard } from '@/components/dashboard/DashboardCashFlowForecastCard'
import { DashboardFirstRunChecklist } from '@/components/dashboard/DashboardFirstRunChecklist'
import { getCreditCardSpending } from '@/lib/creditCards'
import type { AppLayoutContext } from '@/components/layout/AppLayout'
import { PageActions } from '@/components/layout/PageActions'
import { TransactionKindMenu } from '@/components/transactions/TransactionKindMenu'

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
    variant === 'income' ? INCOME
    : variant === 'expense' ? EXPENSE
    : GOLD

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `View ${title.toLowerCase()} details` : undefined}
      className={cn(
        'relative overflow-hidden rounded-[20px] border border-border p-5 transition-colors duration-(--dur-base) group bg-card press-scale focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring',
        onClick && 'cursor-pointer select-none',
        className
      )}
      onClick={onClick}
      onKeyDown={(event) => {
        if (onClick && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          onClick()
        }
      }}

    >


      <div className="flex items-start justify-between mb-4">
        <p className="text-[0.6875rem] font-medium text-muted-foreground uppercase tracking-widest">{title}</p>
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background: variant==='income'?'var(--income-container)':variant==='expense'?'var(--expense-container)':'var(--accent)'}}>
            <Icon className="w-3.5 h-3.5" style={{color:accentColor}} />
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
                color: trend === 'up' ? INCOME : trend === 'down' ? EXPENSE : 'var(--muted-foreground)',
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

function formatMonthLabel(key: string) {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

const NO_BUDGETS: Budget[] = []

export default function DashboardPage() {
  const { openAddTransactionModal } = useOutletContext<AppLayoutContext>()
  const { profile } = useAuth()
  const currency = profile?.default_currency ?? 'USD'
  const currencySymbol = getCurrencySymbol(currency)
  const { accounts, loading: accountsLoading, error: accountsError, refetch: refetchAccounts, updateAccount } = useAccounts()
  const { transactions, loading: txLoading, error: txError, refetch: refetchTransactions } = useTransactions()
  const { categories } = useCategories()
  const { purchases: loanPurchases, allocations: loanAllocations, loading: loansLoading, error: loansError, refetch: refetchLoans } = useLoanPurchases()
  const { startDay, selectedMonth } = useCycle()
  const { budgets, refreshing: budgetsRefreshing } = useBudgets({ selectedMonth, startDay })
  const [chartPeriod, setChartPeriod] = useState<DashboardChartPeriod>('month')
  const [detailView, setDetailView] = useState<DashboardDetailView>(null)

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
    loanPurchases,
    loanAllocations,
    chartPeriod,
    selectedMonth,
    startDay,
  })

  const monthLabel = formatMonthLabel(selectedMonth)
  const loading = accountsLoading || txLoading || loansLoading
  // Figures below are sums over these sources; a failed source would read as zero, so say so once.
  const loadFailed = !!(accountsError || txError || loansError)
  const retryFailedSources = () => {
    if (accountsError) void refetchAccounts()
    if (txError) void refetchTransactions()
    if (loansError) void refetchLoans()
  }
  const { widgets, widgetOrder, toggle, moveWidget, reorderWidget } = useDashboardPrefs()
  const { prefs } = usePreferences()
  // While a new cycle loads the budgets on screen belong to the previous one; don't alert on them.
  const alerts = useSpendingAlerts(budgetsRefreshing ? NO_BUDGETS : budgets, transactions, prefs.largeTransactionThreshold)
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
          statement_balance_locked_at: getLocalDateString(today),
        })
      }
    }

    void lockStatementBalances()
  }, [creditCards, updateAccount])

  return (
    <WidgetDragContext.Provider value={{start:setDraggedWidget,drop:key=>{if(draggedWidget)reorderWidget(draggedWidget,key);setDraggedWidget(null)},end:()=>setDraggedWidget(null)}}>
    <div className="mx-auto grid w-full min-w-0 max-w-7xl gap-4 overflow-x-hidden p-4 md:p-6 lg:grid-cols-[1.5fr_1fr]">
      <div className="hidden md:flex items-start justify-between gap-3 flex-wrap lg:col-span-2">
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
        className="hidden md:block h-px lg:col-span-2"
        style={{ background: 'linear-gradient(90deg, color-mix(in srgb, var(--primary) 35%, transparent), transparent)' }}
      />

      <PageActions desktopOnly>
        <TransactionKindMenu
          onSelect={openAddTransactionModal}
          trigger={
            <Button className="gap-1.5 h-9 text-[0.8125rem] font-medium shrink-0">
              <Plus className="w-3.5 h-3.5" />
              Add Transaction
            </Button>
          }
        />
      </PageActions>

      {loadFailed && !loading && (
        <div className="lg:col-span-2" style={{ order: -1 }}>
          <InlineLoadError
            message="Some of your data didn't load, so totals below may be incomplete."
            onRetry={retryFailedSources}
          />
        </div>
      )}

      {!loading && !loadFailed && (
        <div className="lg:col-span-2" style={{ order: 0 }}>
          <DashboardFirstRunChecklist
            accounts={accounts}
            transactions={transactions}
            onAddTransaction={openAddTransactionModal}
          />
        </div>
      )}

      {(visibleAlerts.length > 0 || widgets.upcomingBills) && (
        <div className="lg:col-span-2" style={{ order: 1 }}>
          <h2 className="text-sm font-semibold">Needs attention</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Warnings and commitments for {monthLabel}</p>
        </div>
      )}

      {visibleAlerts.length > 0 && (
        <div className="space-y-2 lg:col-span-2" style={{ order: 2 }}>
          {visibleAlerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm',
                alert.type === 'budget_exceeded'
                  ? 'border-destructive/30 bg-destructive/5 text-destructive'
                  : 'border-input bg-expense-container text-expense'
              )}
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="flex-1">{alert.message}</span>
              <button
                type="button"
                aria-label="Dismiss warning"
                onClick={() => setDismissedAlerts((state) => new Set([...state, alert.id]))}
              >
                <X className="w-3.5 h-3.5 opacity-60 hover:opacity-100" />
              </button>
            </div>
          ))}
        </div>
      )}

      {widgets.upcomingBills && (
        <DashboardUpcomingBillsCard
          bills={upcomingBills}
          isCurrentMonth={isCurrentMonth}
          monthLabel={monthLabel}
          loading={loading}
          style={widgetGridStyle('upcomingBills')}
        />
      )}

      {widgets.stats && <section className="md:hidden rounded-3xl bg-card p-5" style={{order:0}}>
        <button className="w-full text-left" onClick={()=>setDetailView('balance')}><span className="text-[11px] tracking-[.14em] uppercase text-muted-foreground">Net worth</span><p className="money text-[32px] mt-2">{loading ? '…' : formatCurrency(stats.totalBalance,currency)}</p></button>
        <div className="grid grid-cols-2 gap-3 mt-4">{([{view:'income',label:'↙ In',value:stats.income,tone:'income'},{view:'expenses',label:'↗ Out',value:stats.expenses,tone:'expense'}] as const).map(item=><button key={item.view} className="text-left rounded-xl p-3 min-w-0" style={{background:'var(--'+item.tone+'-container)',color:'var(--'+item.tone+')'}} onClick={()=>setDetailView(item.view)}><span className="text-[11px] uppercase">{item.label}</span><p className="money text-sm mt-1 truncate">{loading?'…':formatCurrency(item.value,currency)}</p></button>)}</div>
      </section>}
      {widgets.stats && (
        <div className="hidden md:grid gap-4 grid-cols-3 lg:col-span-2" style={widgetGridStyle('stats')}>
          <StatCard
            title="Net Worth"
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
          monthLabel={monthLabel}
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
          <RefreshingRegion
            refreshing={budgetsRefreshing}
            label={`Loading ${monthLabel}…`}
            style={widgetGridStyle('budgets')}
          >
            <DashboardBudgetProgressCard budgets={budgets} monthLabel={monthLabel} />
          </RefreshingRegion>
        )}
      </div>

      <div className="contents">
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
    </WidgetDragContext.Provider>
  )
}
