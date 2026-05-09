import { Bell } from 'lucide-react'
import { CORAL } from '@/constants/colors'
import { formatCurrency } from '@/lib/utils'
import type { UpcomingBill } from '@/hooks/useDashboardData'
import { DashboardCardHeader } from '@/components/dashboard/DashboardCardHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardTransactionRow } from '@/components/dashboard/DashboardTransactionRow'

interface DashboardUpcomingBillsCardProps {
  bills: UpcomingBill[]
  isCurrentMonth: boolean
  monthLabel: string
  loading: boolean
  style?: React.CSSProperties
}

function getUpcomingBillDayColor(daysUntil: number) {
  if (daysUntil === 0) return CORAL
  if (daysUntil <= 3) return 'oklch(0.750 0.140 75)'
  return 'oklch(0.570 0.015 290)'
}

export function DashboardUpcomingBillsCard({
  bills,
  isCurrentMonth,
  monthLabel,
  loading,
  style,
}: DashboardUpcomingBillsCardProps) {
  return (
    <div className="rounded-xl border border-border/60 p-5 bg-card" style={style}>
      <DashboardCardHeader
        title="Upcoming Bills"
        subtitle={isCurrentMonth ? 'Recurring expenses this cycle' : `Recurring expenses · ${monthLabel}`}
        icon={<Bell className="w-3.5 h-3.5 text-muted-foreground" />}
      />
      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, index) => <Skeleton key={index} className="h-12" />)}</div>
      ) : bills.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No upcoming bills this cycle</p>
      ) : (
        <div className="space-y-0.5">
          {bills.slice(0, 6).map(({ key, tx, nextDue, daysUntil }) => (
            <DashboardTransactionRow
              key={key}
              icon={tx.category?.icon ?? 'Bill'}
              iconBackgroundColor={`${tx.category?.color ?? '#6b7280'}22`}
              title={tx.description}
              subtitle={
                <>
                  {nextDue.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {tx.recurrence_interval && (
                    <span className="ml-1.5 capitalize opacity-60">· {tx.recurrence_interval}</span>
                  )}
                </>
              }
              amount={
                <span style={{ color: CORAL }}>
                  -{formatCurrency(tx.amount, tx.currency)}
                </span>
              }
              rightDetail={
                daysUntil !== null ? (
                  <p className="text-[0.625rem] font-medium" style={{ color: getUpcomingBillDayColor(daysUntil) }}>
                    {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `in ${daysUntil}d`}
                  </p>
                ) : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
