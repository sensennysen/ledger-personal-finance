import { Bell, CircleDollarSign } from 'lucide-react'
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
    <div className="min-w-0 max-w-full rounded-xl border border-border/60 p-5 bg-card" style={style}>
      <DashboardCardHeader
        title="Upcoming Bills"
        subtitle={isCurrentMonth ? 'Bills due this cycle' : `Bills due · ${monthLabel}`}
        icon={<Bell className="w-3.5 h-3.5 text-muted-foreground" />}
      />
      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, index) => <Skeleton key={index} className="h-12" />)}</div>
      ) : bills.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No upcoming bills this cycle</p>
      ) : (
        <div className="space-y-0.5">
          {bills.slice(0, 6).map(({ key, source, title, icon, color, amount, currency, detail, nextDue, daysUntil }) => (
            <DashboardTransactionRow
              key={key}
              icon={source === 'loan' && !icon ? <CircleDollarSign className="h-4 w-4" /> : icon ?? 'Bill'}
              iconBackgroundColor={`${color}22`}
              title={title}
              subtitle={
                <>
                  {nextDue.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {detail && (
                    <span className="ml-1.5 capitalize opacity-60">· {detail.replaceAll('_', ' ')}</span>
                  )}
                </>
              }
              amount={
                <span style={{ color: CORAL }}>
                  -{formatCurrency(amount, currency)}
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
