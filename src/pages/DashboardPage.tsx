import { useMemo, useState } from 'react'
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
import { TrendingUp, TrendingDown, Wallet, ArrowLeftRight, Plus, ChevronRight } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useAccounts } from '@/hooks/useAccounts'
import { useTransactions } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { useBudgets } from '@/hooks/useBudgets'
import { formatCurrency, getCurrencySymbol, getLast12Months, getLast8Weeks, getLast8Quarters, getMonthRange, groupExpensesByCategory, cn } from '@/lib/utils'
import { BUDGET_WARNING_THRESHOLD } from '@/constants/accounts'
import { EMERALD, CORAL, GOLD } from '@/constants/colors'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useNavigate } from 'react-router-dom'

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
}: {
  title: string
  value: string
  sub?: string
  icon: React.ElementType
  trend?: 'up' | 'down' | 'neutral'
  loading?: boolean
  variant?: 'balance' | 'income' | 'expense' | 'default'
  onClick?: () => void
}) {
  const accentColor =
    variant === 'income' ? EMERALD
    : variant === 'expense' ? CORAL
    : GOLD

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border/60 p-5 transition-all duration-300 group bg-card',
        onClick && 'cursor-pointer select-none'
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
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">{title}</p>
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
              'text-[28px] font-bold leading-none mb-2',
              variant === 'balance' ? 'balance-gradient' : 'money'
            )}
            style={variant !== 'balance' ? { color: accentColor } : undefined}
          >
            {value}
          </p>
          {sub && (
            <p
              className="text-[11px] font-medium"
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

export default function DashboardPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const currency = profile?.default_currency ?? 'USD'
  const currencySymbol = getCurrencySymbol(currency)
  const { accounts, loading: accountsLoading } = useAccounts()
  const { transactions, loading: txLoading } = useTransactions()
  const { categories } = useCategories()
  const { budgets } = useBudgets()
  const [chartPeriod, setChartPeriod] = useState<'weekly' | 'monthly' | 'quarterly'>('monthly')
  const [detailView, setDetailView] = useState<'balance' | 'income' | 'expenses' | 'categories' | null>(null)

  const { start: monthStart, end: monthEnd } = getMonthRange()

  // ---- Stats ----
  const stats = useMemo(() => {
    const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0)
    const monthTx = transactions.filter((t) => t.date >= monthStart && t.date <= monthEnd)
    const income = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expenses = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return { totalBalance, income, expenses, net: income - expenses }
  }, [accounts, transactions, monthStart, monthEnd])

  // ---- Cash flow chart data ----
  const cashFlowData = useMemo(() => {
    const periods =
      chartPeriod === 'weekly' ? getLast8Weeks()
      : chartPeriod === 'quarterly' ? getLast8Quarters()
      : getLast12Months()
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

  // ---- Recent transactions ----
  const recentTx = useMemo(() => transactions.slice(0, 5), [transactions])

  const loading = accountsLoading || txLoading

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-semibold leading-tight">
            {profile?.full_name ? `Good day, ${profile.full_name.split(' ')[0]}.` : 'Dashboard'}
          </h1>
          <p className="text-muted-foreground text-[13px] mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <Button
          className="gap-2 h-9 text-[13px] font-medium"
          style={{ background: 'oklch(0.700 0.115 72)', color: 'oklch(0.090 0.015 72)' }}
          onClick={() => navigate('/transactions')}
        >
          <Plus className="w-3.5 h-3.5" />Add Transaction
        </Button>
      </div>
      {/* Gold separator */}
      <div className="h-px" style={{ background: 'linear-gradient(90deg, oklch(0.700 0.115 72 / 0.35), transparent)' }} />

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Balance"
          value={formatCurrency(stats.totalBalance, currency)}
          icon={Wallet}
          variant="balance"
          loading={loading}
          onClick={() => setDetailView('balance')}
        />
        <StatCard
          title="Monthly Income"
          value={formatCurrency(stats.income, currency)}
          sub="This month"
          icon={TrendingUp}
          trend="up"
          variant="income"
          loading={loading}
          onClick={() => setDetailView('income')}
        />
        <StatCard
          title="Monthly Expenses"
          value={formatCurrency(stats.expenses, currency)}
          sub="This month"
          icon={TrendingDown}
          trend="down"
          variant="expense"
          loading={loading}
          onClick={() => setDetailView('expenses')}
        />
        <StatCard
          title="Net Cash Flow"
          value={formatCurrency(stats.net, currency)}
          sub={stats.net >= 0 ? 'Positive flow' : 'Negative flow'}
          icon={ArrowLeftRight}
          trend={stats.net >= 0 ? 'up' : 'down'}
          loading={loading}
        />
      </div>

      {/* Cash flow chart */}
      <div
        className="rounded-xl border border-border/60 overflow-hidden bg-card"
      >
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-[15px]">Cash Flow</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">Income vs expenses over time</p>
            </div>
            <Tabs value={chartPeriod} onValueChange={(v) => setChartPeriod(v as 'weekly' | 'monthly' | 'quarterly')}>
              <TabsList className="h-8">
                <TabsTrigger value="weekly" className="text-xs px-3">Weekly</TabsTrigger>
                <TabsTrigger value="monthly" className="text-xs px-3">Monthly</TabsTrigger>
                <TabsTrigger value="quarterly" className="text-xs px-3">Quarterly</TabsTrigger>
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
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
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

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Expenses by category — pie */}
        <div
          className="rounded-xl border border-border/60 p-5 bg-card cursor-pointer transition-shadow duration-300 hover:shadow-[0_4px_24px_oklch(0_0_0/25%)]"
          onClick={() => setDetailView('categories')}
        >
          <div className="flex items-start justify-between mb-0.5">
            <p className="font-semibold text-[15px]">Expenses by Category</p>
            <ChevronRight className="w-4 h-4 text-muted-foreground/50 mt-0.5" />
          </div>
          <p className="text-[12px] text-muted-foreground mb-4">This month's spending breakdown</p>
          {loading ? (
            <Skeleton className="h-56 w-full" />
          ) : expensesByCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No expenses this month</p>
          ) : (
            <div className="flex gap-4 items-center">
              <ResponsiveContainer width="50%" height={200}>
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
              <div className="flex-1 space-y-1.5 min-w-0">
                {expensesByCategory.map((cat, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-base">{cat.icon}</span>
                    <span className="truncate flex-1 text-[12px] text-muted-foreground">{cat.name}</span>
                    <span className="money text-[12px] font-medium shrink-0" style={{ color: cat.color }}>{formatCurrency(cat.amount, currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Budget progress */}
        {budgets.length > 0 && (
          <div
            className="rounded-xl border border-border/60 p-5 bg-card"
          >
            <p className="font-semibold text-[15px] mb-0.5">Budget Progress</p>
            <p className="text-[12px] text-muted-foreground mb-4">Spending vs budget limits this month</p>
            <div className="space-y-4">
              {budgets.slice(0, 4).map((b) => {
                const spent = b.spent ?? 0
                const pct = Math.min((spent / b.amount) * 100, 100)
                const over = spent > b.amount
                return (
                  <div key={b.id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[13px]">
                        <span>{b.category?.icon}</span>
                        <span className="text-foreground/80">{b.name}</span>
                      </span>
                      <span
                        className="money text-[12px]"
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

        {/* Recent transactions */}
        <div
          className="rounded-xl border border-border/60 p-5 bg-card"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-semibold text-[15px]">Recent Transactions</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">Latest activity</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/transactions')}
              className="text-[12px] text-muted-foreground hover:text-primary h-7 px-2"
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
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[14px] shrink-0"
                    style={{ backgroundColor: (tx.category?.color ?? '#6b7280') + '22' }}
                  >
                    {tx.category?.icon ?? '💸'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate text-foreground/90">{tx.description}</p>
                    <p className="text-[11px] text-muted-foreground">{tx.date}</p>
                  </div>
                  <p
                    className="money text-[13px] font-semibold shrink-0"
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

      {/* ---- Detail Dialogs ---- */}

      {/* Total Balance detail */}
      <Dialog open={detailView === 'balance'} onOpenChange={(o) => !o && setDetailView(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Total Balance</DialogTitle>
            <p className="text-[12px] text-muted-foreground">Breakdown by account</p>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-2 pr-2">
              {accounts.map((acc) => (
                <div key={acc.id} className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2.5 bg-muted/30">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[16px] shrink-0 border border-border/50"
                    style={{ backgroundColor: acc.color + '22' }}
                  >
                    {acc.icon ?? '🏦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate">{acc.name}</p>
                    <p className="text-[11px] text-muted-foreground capitalize">{acc.type.replace('_', ' ')}</p>
                  </div>
                  <p
                    className="money text-[14px] font-semibold shrink-0"
                    style={{ color: acc.balance >= 0 ? EMERALD : CORAL }}
                  >
                    {formatCurrency(acc.balance, acc.currency)}
                  </p>
                </div>
              ))}
              {accounts.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No accounts yet</p>
              )}
            </div>
          </ScrollArea>
          {accounts.length > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <span className="text-[12px] text-muted-foreground font-medium uppercase tracking-wider">Total</span>
              <span className="money text-[16px] font-bold balance-gradient">{formatCurrency(stats.totalBalance, currency)}</span>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Monthly Income detail */}
      <Dialog open={detailView === 'income'} onOpenChange={(o) => !o && setDetailView(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Monthly Income</DialogTitle>
            <p className="text-[12px] text-muted-foreground">{monthIncomeTx.length} transaction{monthIncomeTx.length !== 1 ? 's' : ''} this month</p>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-1 pr-2">
              {monthIncomeTx.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-white/3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[14px] shrink-0"
                    style={{ backgroundColor: (tx.category?.color ?? '#6b7280') + '22' }}
                  >
                    {tx.category?.icon ?? '💰'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate">{tx.description}</p>
                    <p className="text-[11px] text-muted-foreground">{tx.category?.name ?? 'Uncategorized'} · {tx.date}</p>
                  </div>
                  <p className="money text-[13px] font-semibold shrink-0" style={{ color: EMERALD }}>
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
              <span className="text-[12px] text-muted-foreground font-medium uppercase tracking-wider">Total Income</span>
              <span className="money text-[16px] font-bold" style={{ color: EMERALD }}>{formatCurrency(stats.income, currency)}</span>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Monthly Expenses detail */}
      <Dialog open={detailView === 'expenses'} onOpenChange={(o) => !o && setDetailView(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Monthly Expenses</DialogTitle>
            <p className="text-[12px] text-muted-foreground">{monthExpenseTx.length} transaction{monthExpenseTx.length !== 1 ? 's' : ''} this month</p>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-1 pr-2">
              {monthExpenseTx.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-white/3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[14px] shrink-0"
                    style={{ backgroundColor: (tx.category?.color ?? '#6b7280') + '22' }}
                  >
                    {tx.category?.icon ?? '💸'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate">{tx.description}</p>
                    <p className="text-[11px] text-muted-foreground">{tx.category?.name ?? 'Uncategorized'} · {tx.date}</p>
                  </div>
                  <p className="money text-[13px] font-semibold shrink-0" style={{ color: CORAL }}>
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
              <span className="text-[12px] text-muted-foreground font-medium uppercase tracking-wider">Total Expenses</span>
              <span className="money text-[16px] font-bold" style={{ color: CORAL }}>{formatCurrency(stats.expenses, currency)}</span>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Expenses by Category detail */}
      <Dialog open={detailView === 'categories'} onOpenChange={(o) => !o && setDetailView(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Expenses by Category</DialogTitle>
            <p className="text-[12px] text-muted-foreground">This month's spending breakdown</p>
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
                      <span className="text-[18px]">{cat.icon}</span>
                      <span className="flex-1 text-[13px] font-medium">{cat.name}</span>
                      <span className="money text-[13px] font-semibold shrink-0" style={{ color: cat.color }}>
                        {formatCurrency(cat.amount, currency)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-border overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: cat.color }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">{pct.toFixed(1)}% of total · {catTxs.length} transaction{catTxs.length !== 1 ? 's' : ''}</p>
                    {catTxs.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-border/30">
                        {catTxs.map((tx) => (
                          <div key={tx.id} className="flex items-center justify-between gap-2 py-1">
                            <p className="text-[12px] text-muted-foreground truncate flex-1">{tx.description}</p>
                            <p className="text-[12px] money font-medium shrink-0" style={{ color: CORAL }}>
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
