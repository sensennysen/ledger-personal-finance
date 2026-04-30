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
import { useAccounts } from '@/hooks/useAccounts'
import { useTransactions } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { useBudgets } from '@/hooks/useBudgets'
import { formatCurrency, getLast12Months, getMonthRange } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  trend,
  loading,
}: {
  title: string
  value: string
  sub?: string
  icon: React.ElementType
  trend?: 'up' | 'down' | 'neutral'
  loading?: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <>
            <p className="text-2xl font-bold">{value}</p>
            {sub && (
              <p className={`text-xs mt-1 ${
                trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground'
              }`}>
                {sub}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { accounts, loading: accountsLoading } = useAccounts()
  const { transactions, loading: txLoading } = useTransactions()
  const { categories } = useCategories()
  const { budgets } = useBudgets()
  const [chartPeriod, setChartPeriod] = useState<'6m' | '12m'>('6m')

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
    const months = getLast12Months()
    const count = chartPeriod === '6m' ? 6 : 12
    return months.slice(-count).map(({ label, start, end }) => {
      const monthTx = transactions.filter((t) => t.date >= start && t.date <= end)
      return {
        month: label,
        income: monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
        expenses: monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
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
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Button className="gap-2" onClick={() => navigate('/transactions')}>
          <Plus className="w-4 h-4" />Add Transaction
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Balance"
          value={formatCurrency(stats.totalBalance)}
          icon={Wallet}
          loading={loading}
        />
        <StatCard
          title="Monthly Income"
          value={formatCurrency(stats.income)}
          sub="This month"
          icon={TrendingUp}
          trend="up"
          loading={loading}
        />
        <StatCard
          title="Monthly Expenses"
          value={formatCurrency(stats.expenses)}
          sub="This month"
          icon={TrendingDown}
          trend="down"
          loading={loading}
        />
        <StatCard
          title="Net Cash Flow"
          value={formatCurrency(stats.net)}
          sub={stats.net >= 0 ? 'Positive flow' : 'Negative flow'}
          icon={ArrowLeftRight}
          trend={stats.net >= 0 ? 'up' : 'down'}
          loading={loading}
        />
      </div>

      {/* Cash flow chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Cash Flow</CardTitle>
              <CardDescription>Income vs expenses over time</CardDescription>
            </div>
            <Tabs value={chartPeriod} onValueChange={(v) => setChartPeriod(v as '6m' | '12m')}>
              <TabsList>
                <TabsTrigger value="6m">6M</TabsTrigger>
                <TabsTrigger value="12m">12M</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={cashFlowData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="income-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expense-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value) => formatCurrency(value as number)}
                  contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend />
                <Area type="monotone" dataKey="income" stroke="#22c55e" fill="url(#income-grad)" strokeWidth={2} name="Income" />
                <Area type="monotone" dataKey="expenses" stroke="#ef4444" fill="url(#expense-grad)" strokeWidth={2} name="Expenses" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Expenses by category — pie */}
        <Card>
          <CardHeader>
            <CardTitle>Expenses by Category</CardTitle>
            <CardDescription>This month's spending breakdown</CardDescription>
          </CardHeader>
          <CardContent>
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
                      innerRadius={55}
                      outerRadius={80}
                      strokeWidth={2}
                    >
                      {expensesByCategory.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(v as number)} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5 min-w-0">
                  {expensesByCategory.map((cat, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-base">{cat.icon}</span>
                      <span className="truncate flex-1 text-xs">{cat.name}</span>
                      <span className="font-medium text-xs shrink-0">{formatCurrency(cat.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account balances — bar */}
        <Card>
          <CardHeader>
            <CardTitle>Account Balances</CardTitle>
            <CardDescription>Current balance per account</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-56 w-full" />
            ) : accountBalanceData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">No accounts yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={accountBalanceData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => formatCurrency(v as number)} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="balance" radius={[4, 4, 0, 0]} name="Balance">
                    {accountBalanceData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Budget progress */}
        {budgets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Budget Progress</CardTitle>
              <CardDescription>Spending vs budget limits this month</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {budgets.slice(0, 4).map((b) => {
                const spent = b.spent ?? 0
                const pct = Math.min((spent / b.amount) * 100, 100)
                const over = spent > b.amount
                return (
                  <div key={b.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1">
                        {b.category?.icon} {b.name}
                      </span>
                      <span className={over ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                        {formatCurrency(spent)} / {formatCurrency(b.amount)}
                      </span>
                    </div>
                    <Progress
                      value={pct}
                      className={over ? '[&>div]:bg-destructive' : pct > 80 ? '[&>div]:bg-yellow-500' : ''}
                    />
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* Recent transactions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Latest activity</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/transactions')}>View all</Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : recentTx.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No transactions yet</p>
            ) : (
              recentTx.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 py-1">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                    style={{ backgroundColor: tx.category ? tx.category.color + '20' : '#f1f5f9' }}
                  >
                    {tx.category?.icon ?? '💸'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">{tx.date}</p>
                  </div>
                  <p className={`text-sm font-semibold shrink-0 ${
                    tx.type === 'income' ? 'text-green-600' : tx.type === 'expense' ? 'text-red-500' : 'text-blue-500'
                  }`}>
                    {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                    {formatCurrency(tx.amount, tx.currency)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
