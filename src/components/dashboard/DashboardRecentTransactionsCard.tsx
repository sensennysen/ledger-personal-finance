import { ArrowLeftRight, Clock } from 'lucide-react'
import { useEntryDetail } from '@/contexts/EntryContext'
import { useNavigate } from 'react-router-dom'
import { EXPENSE, INCOME, TRANSFER } from '@/constants/colors'
import { formatCurrency, getLocalDateString } from '@/lib/utils'
import { countsYet } from '@/lib/countsYet'
import { MINUS } from '@/lib/netSign'
import type { Transaction } from '@/types'
import { Button } from '@/components/ui/button'
import { DashboardCardHeader } from '@/components/dashboard/DashboardCardHeader'
import { EmptyState } from '@/components/ui/empty-state'
import { DashboardTransactionRow, DashboardTransactionRowSkeleton } from '@/components/dashboard/DashboardTransactionRow'

interface DashboardRecentTransactionsCardProps {
  recentTransactions: Transaction[]
  isCurrentMonth: boolean
  monthLabel: string
  loading: boolean
  style?: React.CSSProperties
}

function getTransactionAmountColor(type: Transaction['type']) {
  if (type === 'income') return INCOME
  if (type === 'expense') return EXPENSE
  return TRANSFER
}

function getTransactionPrefix(type: Transaction['type']) {
  if (type === 'income') return '+'
  if (type === 'expense') return MINUS
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
  const openDetail = useEntryDetail()
  // A row dated later is listed but not counted yet (LED-238).
  const today = getLocalDateString()

  return (
    <div className="min-w-0 max-w-full rounded-[20px] border border-border p-4 md:p-5 bg-card" style={style}>
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
        <div className="space-y-0.5" aria-busy="true">{[...Array(5)].map((_, index) => <DashboardTransactionRowSkeleton key={index} />)}</div>
      ) : recentTransactions.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="No transactions yet"
          description="Your first entry will show up here."
          bare
        />
      ) : (
        <div className="space-y-0.5">
          {recentTransactions.map((transaction) => (
            <DashboardTransactionRow
              key={transaction.id}
              onClick={()=>openDetail?.(transaction)}
              icon={transaction.category?.icon ?? 'Tx'}
              iconBackgroundColor={'var(--'+transaction.type+'-container)'}
              title={transaction.description}
              subtitle={countsYet(transaction.date, today) ? transaction.date : `${transaction.date} · Scheduled`}
              amount={
                <span style={{ color: getTransactionAmountColor(transaction.type) }}>
                  {getTransactionPrefix(transaction.type)}
                  {formatCurrency(transaction.amount, transaction.currency)}
                </span>
              }
              rightDetail={
                transaction.queued ? (
                  <span className="inline-flex items-center gap-1 text-[0.6875rem] text-warning">
                    <Clock className="h-3 w-3" aria-hidden />Not synced yet
                  </span>
                ) : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
