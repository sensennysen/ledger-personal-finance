import { Fragment, useState } from 'react'
import { AlertTriangle, Bell, CircleDollarSign, Receipt, X } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { UpcomingBill } from '@/hooks/useDashboardData'
import type { SpendingAlert } from '@/hooks/useSpendingAlerts'
import { Button } from '@/components/ui/button'
import { Skeleton, SkeletonText } from '@/components/ui/skeleton'
import { PHONE_LIMIT, formatDaysUntil, getUpcomingBillDayColor } from '@/lib/upcomingBills'

const divider = <div aria-hidden className="ml-[60px] h-px bg-border" />

/**
 * Phones (M-08): budget warnings, large transactions and the next bill in one
 * card directly under net worth, in place of the heading, the alert boxes and
 * the Upcoming Bills strip.
 */
export function DashboardAttentionCard({
  alerts,
  onDismiss,
  bills,
  billsEnabled,
  loading,
  onPay,
  isCurrentMonth,
  monthLabel,
  style,
}: {
  alerts: SpendingAlert[]
  onDismiss: (id: string) => void
  bills: UpcomingBill[]
  billsEnabled: boolean
  loading: boolean
  onPay?: (payment: NonNullable<UpcomingBill['payment']>) => void
  isCurrentMonth: boolean
  monthLabel: string
  style?: React.CSSProperties
}) {
  const [expanded, setExpanded] = useState(false)
  const billRows = billsEnabled && !loading ? bills : []
  const shownBills = expanded ? billRows : billRows.slice(0, PHONE_LIMIT)
  const showSkeleton = loading && billsEnabled
  if (!showSkeleton && alerts.length === 0 && billRows.length === 0) return null
  const count = alerts.length + shownBills.length

  const rows = [
    ...alerts.map((alert) => (
      <div key={alert.id} className="flex min-h-14 items-center gap-3 pl-4 pr-1">
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-expense-container"
        >
          {alert.type === 'large_transaction' ? (
            <Receipt className="size-4 text-expense" />
          ) : (
            <AlertTriangle className="size-4 text-expense" />
          )}
        </span>
        <div className="min-w-0 flex-1 py-2">
          <p className="truncate text-sm font-medium">{alert.title}</p>
          <p
            className={`money truncate text-xs ${alert.type === 'budget_exceeded' ? 'text-expense' : 'text-warning'}`}
          >
            {alert.detail}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 shrink-0"
          aria-label="Dismiss warning"
          onClick={() => onDismiss(alert.id)}
        >
          <X className="size-4" />
        </Button>
      </div>
    )),
    ...shownBills.map(({ key, source, title, icon, color, amount, currency, daysUntil, nextDue, payment }) => (
      <div key={key} className="flex min-h-[60px] items-center gap-3 pl-4 pr-3">
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-[10px] text-sm"
          style={{ backgroundColor: `${color}22` }}
        >
          {source === 'loan' && !icon ? (
            <CircleDollarSign className="size-4" />
          ) : (
            icon ?? <Bell className="size-4" />
          )}
        </span>
        <div className="min-w-0 flex-1 py-2">
          <p className="truncate text-sm font-medium">{title}</p>
          <p
            className="truncate text-xs"
            style={{ color: daysUntil !== null ? getUpcomingBillDayColor(daysUntil) : undefined }}
          >
            <span className="money text-foreground">{formatCurrency(amount, currency)}</span> ·{' '}
            {daysUntil !== null
              ? formatDaysUntil(daysUntil)
              : nextDue.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        </div>
        {payment && onPay && (
          <Button
            variant="secondary"
            className="h-9 shrink-0 px-4 text-[0.8125rem]"
            aria-label={`Pay now: ${title}`}
            onClick={() => onPay(payment)}
          >
            Pay
          </Button>
        )}
      </div>
    )),
    ...(showSkeleton
      ? [0, 1].map((item) => (
          <div key={`skeleton-${item}`} className="flex min-h-[60px] items-center gap-3 pl-4 pr-3" aria-hidden>
            <Skeleton className="size-8 shrink-0 rounded-[10px]" />
            <div className="min-w-0 flex-1">
              <p className="text-sm"><SkeletonText className="w-32" /></p>
              <p className="text-xs"><SkeletonText className="w-20" /></p>
            </div>
          </div>
        ))
      : []),
  ]

  return (
    <section
      aria-label="Needs attention"
      aria-busy={showSkeleton || undefined}
      className="col-span-full overflow-hidden rounded-[20px] border border-border bg-card"
      style={style}
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-1.5">
        <div className="min-w-0">
          <h2 className="text-[0.9375rem] font-semibold">
            Needs attention
            {!showSkeleton && <span className="font-medium text-muted-foreground"> · {count}</span>}
          </h2>
          {!isCurrentMonth && <p className="text-xs text-muted-foreground">{monthLabel}</p>}
        </div>
        {billRows.length > PHONE_LIMIT && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((open) => !open)}
            className="-mr-2 h-10 shrink-0 rounded-full px-2 text-[0.8125rem] font-medium text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
          >
            {expanded ? 'Show less' : `${billRows.length} bills`}
          </button>
        )}
      </div>
      <div className="pb-1">
        {rows.map((row, index) => (
          <Fragment key={row.key}>
            {index > 0 && divider}
            {row}
          </Fragment>
        ))}
      </div>
    </section>
  )
}
