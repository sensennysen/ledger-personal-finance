import { useMemo, useState } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
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
import { TrendingUp, TrendingDown, Wallet, ArrowLeftRight, Plus } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useAccounts } from '@/hooks/useAccounts'
import { useTransactions } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { useBudgets } from '@/hooks/useBudgets'
import { formatCurrency, getCurrencySymbol, getLast12Months, getLast8Weeks, getLast8Quarters, getMonthRange, cn } from '@/lib/utils'
import { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'

const EMERALD = 'oklch(0.660 0.150 155)'
const CORAL = 'oklch(0.620 0.160 18)'
const GOLD = 'oklch(0.700 0.115 72)'
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
}: {
  title: string
  value: string
  sub?: string
  icon: React.ElementType
  trend?: 'up' | 'down' | 'neutral'
  loading?: boolean
  variant?: 'balance' | 'income' | 'expense' | 'default'
}) {
  const accentColor =
    variant === 'income' ? EMERALD
    : variant === 'expense' ? CORAL
    : GOLD

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-border/60 p-5 transition-all duration-300 group bg-card"
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
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center"
          className="bg-muted border border-border"
        >
          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
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

  // ---- Expenses by category (this month) ----
  const expensesByCategory = useMemo(() => {
    const monthExpenses = transactions.filter(
      (t) => t.type === 'expense' && t.date >= monthStart && t.date <= monthEnd && t.category_id
    )
    const map: Record<string, { name: string; color: string; icon: string; amount: number }> = {}
    for (const tx of monthExpenses) {
      if (!tx.category_id) continue
      const cat = categories.find((c) => c.id === tx.category_id)
      if (!map[tx.category_id]) {
        map[tx.category_id] = {
          name: cat?.name ?? 'Unknown',
          color: cat?.color ?? '#94a3b8',
          icon: cat?.icon ?? '📦',
          amount: 0,
        }
      }
      map[tx.category_id].amount += tx.amount
    }
    return Object.values(map).sort((a, b) => b.amount - a.amount).slice(0, 8)
  }, [transactions, categories, monthStart, monthEnd])

  // ---- Account balances ----
  const accountBalanceData = useMemo(
    () => accounts.map((a) => ({ name: a.name, balance: a.balance, color: a.color })),
    [accounts]
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
        />
        <StatCard
          title="Monthly Income"
          value={formatCurrency(stats.income, currency)}
          sub="This month"
          icon={TrendingUp}
          trend="up"
          variant="income"
          loading={loading}
        />
        <StatCard
          title="Monthly Expenses"
          value={formatCurrency(stats.expenses, currency)}
          sub="This month"
          icon={TrendingDown}
          trend="down"
          variant="expense"
          loading={loading}
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
          className="rounded-xl border border-border/60 p-5 bg-card"
        >
          <p className="font-semibold text-[15px] mb-0.5">Expenses by Category</p>
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

        {/* Account balances — bar */}
        <div
          className="rounded-xl border border-border/60 p-5 bg-card"
        >
          <p className="font-semibold text-[15px] mb-0.5">Account Balances</p>
          <p className="text-[12px] text-muted-foreground mb-4">Current balance per account</p>
          {loading ? (
            <Skeleton className="h-56 w-full" />
          ) : accountBalanceData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No accounts yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={accountBalanceData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${currencySymbol}${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v) => formatCurrency(v as number, currency)}
                  contentStyle={CHART_TOOLTIP_STYLE}
                  cursor={{ fill: 'var(--muted)' }}
                />
                <Bar dataKey="balance" radius={[5, 5, 0, 0]} name="Balance">
                  {accountBalanceData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
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
                        style={{ color: over ? CORAL : pct > 80 ? 'oklch(0.750 0.140 75)' : 'oklch(0.570 0.015 290)' }}
                      >
                        {formatCurrency(spent, b.currency)} / {formatCurrency(b.amount, b.currency)}
                      </span>
                    </div>
                    <Progress
                      value={pct}
                      className={over ? '[&>div]:bg-[oklch(0.620_0.160_18)]' : pct > 80 ? '[&>div]:bg-[oklch(0.750_0.140_75)]' : '[&>div]:bg-primary'}
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
    </div>
  )
}
