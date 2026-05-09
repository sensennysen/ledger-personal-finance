import { useNavigate } from 'react-router-dom'
import { CORAL, EMERALD, GOLD } from '@/constants/colors'
import { formatCurrency } from '@/lib/utils'
import type { Transaction } from '@/types'
import { Button } from '@/components/ui/button'
import { DashboardCardHeader } from '@/components/dashboard/DashboardCardHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardTransactionRow } from '@/components/dashboard/DashboardTransactionRow'

interface DashboardRecentTransactionsCardProps {
  recentTransactions: Transaction[]
  isCurrentMonth: boolean
  monthLabel: string
  loading: boolean
  style?: React.CSSProperties
}

function getTransactionAmountColor(type: Transaction['type']) {
  if (type === 'income') return EMERALD
  if (type === 'expense') return CORAL
  return GOLD
}

function getTransactionPrefix(type: Transaction['type']) {
  if (type === 'income') return '+'
  if (type === 'expense') return '-'
  return ''
}

export function DashboardRecentTransactionsCard({
  recentTransactions,
  isCurrentMonth,
  monthLabel,
  loading,
  style,
}: DashboardRecentTransactionsCardProps) {
  const navigate = useNavigate()

  return (
    <div className="rounded-xl border border-border/60 p-5 bg-card" style={style}>
      <DashboardCardHeader
        title="Recent Transactions"
        subtitle={isCurrentMonth ? 'Latest activity' : monthLabel}
        action={(
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/transactions')}
            className="text-xs text-muted-foreground hover:text-primary h-7 px-2"
          >
            View all
          </Button>
        )}
      />
      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, index) => <Skeleton key={index} className="h-11" />)}</div>
      ) : recentTransactions.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No transactions yet</p>
      ) : (
        <div className="space-y-0.5">
          {recentTransactions.map((transaction) => (
            <DashboardTransactionRow
              key={transaction.id}
              icon={transaction.category?.icon ?? 'Tx'}
              iconBackgroundColor={`${transaction.category?.color ?? '#6b7280'}22`}
              title={transaction.description}
              subtitle={transaction.date}
              amount={
                <span style={{ color: getTransactionAmountColor(transaction.type) }}>
                  {getTransactionPrefix(transaction.type)}
                  {formatCurrency(transaction.amount, transaction.currency)}
                </span>
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
