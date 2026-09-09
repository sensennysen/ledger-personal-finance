import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, CreditCard, Plus } from 'lucide-react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useAccounts } from '@/hooks/useAccounts'
import { useTransactions } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { useLoanPurchases } from '@/hooks/useLoanPurchases'
import {
  useDashboardData,
  type DashboardChartPeriod,
} from '@/hooks/useDashboardData'
import { useCycle } from '@/contexts/cycleState'
import { useEntryDetail } from '@/contexts/EntryContext'
import { getCreditCardSpending } from '@/lib/creditCards'
import { formatCurrency, getLocalDateString, cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { TransactionKindMenu } from '@/components/transactions/TransactionKindMenu'
import type { AppLayoutContext } from '@/components/layout/AppLayout'
import type { Transaction } from '@/types'

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
function formatMonthLabel(key: string) {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}
function addMonths(key: string, delta: number) {
  const [year, month] = key.split('-').map(Number)
  return getMonthKey(new Date(year, month - 1 + delta, 1))
}

const CHART_TABS: { value: DashboardChartPeriod; label: string }[] = [
  { value: 'month', label: 'Daily' },
  { value: 'quarterly', label: '3 mo' },
  { value: 'yearly', label: '12 mo' },
]

function txTone(type: Transaction['type']) {
  return type === 'income'
    ? { ink: 'var(--income)', container: 'var(--income-container)', sign: '+' }
    : type === 'expense'
      ? { ink: 'var(--expense)', container: 'var(--expense-container)', sign: '−' }
      : { ink: 'var(--transfer)', container: 'var(--transfer-container)', sign: '' }
}

function TransactionRows({ transactions }: { transactions: Transaction[] }) {
  const openDetail = useEntryDetail()
  if (transactions.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No transactions yet
      </p>
    )
  }
  return (
    <>
      {transactions.map((tx) => {
        const tone = txTone(tx.type)
        return (
          <button
            key={tx.id}
            type="button"
            onClick={() => openDetail?.(tx)}
            className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 border-t border-outline-variant py-2.5 text-left first:border-t-0"
          >
            <span
              className="size-10 rounded-xl"
              style={{ background: tone.container }}
            />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-foreground">
                {tx.description}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {new Date(`${tx.date}T00:00:00`).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
                {tx.category?.name ? ` · ${tx.category.name}` : ''}
              </span>
            </span>
            <span
              className="money whitespace-nowrap text-[13px] font-semibold"
              style={{ color: tone.ink }}
            >
              {tone.sign}
              {formatCurrency(tx.amount, tx.currency)}
            </span>
          </button>
        )
      })}
    </>
  )
}

export default function DashboardPage() {
  const { openAddTransactionModal } = useOutletContext<AppLayoutContext>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const currency = profile?.default_currency ?? 'USD'
  const { accounts, loading: accountsLoading, updateAccount } = useAccounts()
  const { transactions, loading: txLoading } = useTransactions()
  const { categories } = useCategories()
  const {
    purchases: loanPurchases,
    allocations: loanAllocations,
    loading: loansLoading,
  } = useLoanPurchases()
  const { startDay, selectedMonth, setSelectedMonth } = useCycle()
  const [chartPeriod, setChartPeriod] = useState<DashboardChartPeriod>('month')

  const {
    isCurrentMonth,
    stats,
    cashFlowData,
    recentTx,
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

  // Lock in each credit card's statement balance once its statement day passes.
  useEffect(() => {
    if (!navigator.onLine || creditCards.length === 0) return
    const today = new Date()
    const day = today.getDate()
    void (async () => {
      for (const creditCard of creditCards) {
        if (!creditCard.statement_day || day < creditCard.statement_day) continue
        const lockMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
        if (creditCard.statement_balance_locked_at?.startsWith(lockMonthKey))
          continue
        await updateAccount(creditCard.id, {
          statement_balance: getCreditCardSpending(creditCard),
          statement_paid_amount: 0,
          statement_balance_locked_at: getLocalDateString(today),
        })
      }
    })()
  }, [creditCards, updateAccount])

  const loading = accountsLoading || txLoading || loansLoading
  const monthLabel = formatMonthLabel(selectedMonth)
  const monthShort = monthLabel.split(' ')[0].slice(0, 3)
  const card = creditCardsWithState[0]
  const chartMax = Math.max(
    1,
    ...cashFlowData.map((point) => Math.max(point.income, point.expenses)),
  )

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4 p-4 md:space-y-5 md:p-8">
      {/* Header (desktop/tablet) */}
      <div className="hidden md:block">
        <h1 className="text-[26px] font-bold tracking-[-0.01em] text-foreground">
          {profile?.full_name
            ? `Good day, ${profile.full_name.split(' ')[0]}.`
            : 'Good day.'}
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
        <div
          className="mt-4 h-px"
          style={{
            background:
              'linear-gradient(90deg, color-mix(in srgb, var(--primary) 35%, transparent), transparent)',
          }}
        />
      </div>

      {/* Month stepper + Add (desktop/tablet) */}
      <div className="hidden md:flex items-center justify-between">
        <div className="flex w-[260px] items-center gap-0.5 rounded-full bg-surface-container px-2 py-1.5">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setSelectedMonth((m) => addMonths(m, -1))}
            className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="flex-1 text-center text-[13px] font-semibold text-foreground">
            {monthLabel}
          </span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setSelectedMonth((m) => addMonths(m, 1))}
            disabled={isCurrentMonth}
            className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <TransactionKindMenu
          onSelect={openAddTransactionModal}
          trigger={
            <button
              type="button"
              className="flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-[14px] font-semibold text-primary-foreground shadow-[var(--el1)]"
            >
              <Plus className="size-4" strokeWidth={2.4} />
              <span className="lg:inline hidden">Add Transaction</span>
              <span className="lg:hidden">Add</span>
            </button>
          }
        />
      </div>

      {/* Net Worth hero */}
      <section className="grid items-center gap-6 rounded-[20px] bg-card p-5 md:p-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Net Worth
          </span>
          {loading ? (
            <Skeleton className="mt-2 h-12 w-56" />
          ) : (
            <p className="money mt-2 text-[34px] font-bold leading-none text-foreground md:text-[40px] lg:text-[48px]">
              {formatCurrency(stats.totalBalance, currency)}
            </p>
          )}
          <p className="mt-2 text-[12px] text-muted-foreground">
            Assets minus liabilities
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div
            className="min-w-0 rounded-2xl p-3.5"
            style={{ background: 'var(--income-container)', color: 'var(--income)' }}
          >
            <span className="block truncate text-[11px] font-semibold uppercase">
              Income · {monthShort}
            </span>
            <p className="money mt-1.5 truncate text-[17px] font-bold sm:text-[19px] lg:text-[20px]">
              {formatCurrency(stats.income, currency)}
            </p>
          </div>
          <div
            className="min-w-0 rounded-2xl p-3.5"
            style={{
              background: 'var(--expense-container)',
              color: 'var(--expense)',
            }}
          >
            <span className="block truncate text-[11px] font-semibold uppercase">
              Expenses · {monthShort}
            </span>
            <p className="money mt-1.5 truncate text-[17px] font-bold sm:text-[19px] lg:text-[20px]">
              {formatCurrency(stats.expenses, currency)}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:gap-5 lg:grid-cols-[1.5fr_1fr]">
        {/* Cash Flow */}
        <section className="rounded-[20px] bg-card p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold text-foreground">Cash Flow</h2>
            <div className="flex rounded-full border border-outline p-0.5">
              {CHART_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setChartPeriod(tab.value)}
                  className={cn(
                    'rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors',
                    chartPeriod === tab.value
                      ? 'bg-secondary-container font-semibold text-on-secondary-container'
                      : 'text-muted-foreground',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-[150px] w-full" />
          ) : (
            <div className="flex h-[150px] items-end gap-2.5">
              {cashFlowData.slice(-12).map((point, index) => (
                <div
                  key={index}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                >
                  <div
                    className="w-full rounded-t"
                    style={{
                      height: `${(point.income / chartMax) * 100}%`,
                      background: 'var(--primary)',
                    }}
                  />
                  <div
                    className="w-full rounded-t"
                    style={{
                      height: `${(point.expenses / chartMax) * 100}%`,
                      background: 'var(--expense)',
                    }}
                  />
                </div>
              ))}
            </div>
          )}
          <div className="mt-3.5 flex gap-5 text-[12px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-[3px]"
                style={{ background: 'var(--primary)' }}
              />
              Income
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-[3px]"
                style={{ background: 'var(--expense)' }}
              />
              Expenses
            </span>
          </div>
        </section>

        {/* Credit Card */}
        {card && (
          <section className="rounded-[20px] bg-card p-5">
            <div className="mb-3.5 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-foreground">
                Credit Card
              </h2>
              <span className="flex size-7 items-center justify-center rounded-lg bg-surface-container text-muted-foreground">
                <CreditCard className="size-[15px]" />
              </span>
            </div>
            <p className="text-[14px] font-semibold text-foreground">
              {card.acc.name}
            </p>
            <p className="mb-3.5 mt-0.5 text-[12px] text-muted-foreground">
              Spent {formatCurrency(card.spending, card.acc.currency)} of{' '}
              {formatCurrency(card.acc.credit_limit ?? 0, card.acc.currency)}
            </p>
            <div className="mb-4 h-1.5 rounded-full bg-surface-container">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, card.utilizationPct)}%`,
                  background: card.nearLimit
                    ? 'var(--expense)'
                    : 'var(--income)',
                }}
              />
            </div>
            <div className="flex justify-between border-b border-transparent py-2 text-[12px]">
              <span className="text-muted-foreground">Statement</span>
              <span className="font-semibold text-foreground">
                {card.statementCountdown === null
                  ? '—'
                  : `in ${card.statementCountdown} days`}
              </span>
            </div>
            <div className="flex justify-between py-2 text-[12px]">
              <span className="text-muted-foreground">Payment due</span>
              <span className="font-semibold text-foreground">
                {card.dueCountdown === null
                  ? '—'
                  : `in ${card.dueCountdown} days`}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between rounded-xl bg-surface-container px-3 py-2.5 text-[12px]">
              <span className="text-muted-foreground">Amount to pay</span>
              <span className="money font-bold text-foreground">
                {formatCurrency(card.remainingToPay, card.acc.currency)}
              </span>
            </div>
          </section>
        )}
      </div>

      {/* Recent Transactions */}
      <section className="rounded-[20px] bg-card p-5">
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-foreground">
            Recent Transactions
          </h2>
          <button
            type="button"
            onClick={() => navigate('/transactions')}
            className="text-[13px] font-semibold text-primary"
          >
            View all
          </button>
        </div>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <TransactionRows transactions={recentTx} />
        )}
      </section>
    </div>
  )
}
