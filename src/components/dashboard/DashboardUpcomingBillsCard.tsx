import { Bell, CircleDollarSign } from 'lucide-react'
import { EXPENSE, WARNING_INK } from '@/constants/colors'
import { formatCurrency } from '@/lib/utils'
import type { UpcomingBill } from '@/hooks/useDashboardData'
import { Button } from '@/components/ui/button'
import { DashboardCardHeader } from '@/components/dashboard/DashboardCardHeader'
import { SkeletonText } from '@/components/ui/skeleton'

interface DashboardUpcomingBillsCardProps {
  bills: UpcomingBill[]
  isCurrentMonth: boolean
  monthLabel: string
  loading: boolean
  /** Opens the loan repayment form for a bill; bills that pay nothing (recurring expenses) get no button. */
  onPay?: (payment: NonNullable<UpcomingBill['payment']>) => void
  style?: React.CSSProperties
}

function getUpcomingBillDayColor(daysUntil: number) {
  if (daysUntil <= 0) return EXPENSE
  if (daysUntil <= 3) return WARNING_INK
  return 'var(--muted-foreground)'
}

function formatDaysUntil(daysUntil: number) {
  if (daysUntil < 0) return daysUntil === -1 ? '1 day overdue' : `${-daysUntil} days overdue`
  if (daysUntil === 0) return 'today'
  if (daysUntil === 1) return 'tomorrow'
  return `in ${daysUntil} days`
}

const STRIP_LIMIT = 4
// A phone shows the next bill only, as design 18a's strip does, so Home's first four widgets fit
// above the bottom nav at 390x844 (LED-202); the rest are counted in "+N more".
const PHONE_LIMIT = 1

// A strip, not a grid cell (LED-78): one line of the next few bills, full width.
export function DashboardUpcomingBillsCard({
  bills,
  isCurrentMonth,
  monthLabel,
  loading,
  onPay,
  style,
}: DashboardUpcomingBillsCardProps) {
  const shown = bills.slice(0, STRIP_LIMIT)
  const more = bills.length - shown.length
  const phoneMore = bills.length - Math.min(bills.length, PHONE_LIMIT)
  return (
    <section
      aria-label="Upcoming bills"
      className="col-span-full flex min-w-0 max-w-full flex-col gap-2 rounded-[20px] border border-border bg-card px-4 py-2.5 md:py-3 md:flex-row md:items-center md:gap-5 md:px-5"
      style={style}
    >
      <DashboardCardHeader
        title="Upcoming Bills"
        subtitle={isCurrentMonth ? undefined : monthLabel}
        className="mb-0 shrink-0 md:w-40"
        action={
          !loading && phoneMore > 0 ? <span className="text-xs text-muted-foreground md:hidden">+{phoneMore} more</span> : undefined
        }
      />
      {loading ? (
        <ul className="flex min-w-0 flex-1 flex-col gap-1 md:flex-row md:flex-wrap md:gap-x-6" aria-busy="true">
          {[0, 1, 2].map((item) => (
            <li key={item} className="flex min-w-0 items-center gap-2 text-sm">
              <span className="size-6 shrink-0 rounded-md bg-muted" aria-hidden />
              <SkeletonText className="w-24" />
              <SkeletonText className="w-14" />
              <SkeletonText className="w-12" />
            </li>
          ))}
        </ul>
      ) : bills.length === 0 ? (
        <p className="flex-1 text-sm text-muted-foreground">No upcoming bills this cycle</p>
      ) : (
        <ul className="flex min-w-0 flex-1 flex-col gap-1 md:flex-row md:flex-wrap md:gap-x-6">
          {shown.map(({ key, source, title, icon, color, amount, currency, daysUntil, nextDue, payment }, index) => (
            <li key={key} className={`flex min-w-0 items-center gap-2 text-sm ${index >= PHONE_LIMIT ? 'max-md:hidden' : ''}`}>
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-xs"
                style={{ backgroundColor: `${color}22` }}
                aria-hidden
              >
                {source === 'loan' && !icon ? <CircleDollarSign className="h-3.5 w-3.5" /> : icon ?? <Bell className="h-3.5 w-3.5" />}
              </span>
              <span className="min-w-0 truncate">{title}</span>
              <span className="money shrink-0 font-medium">{formatCurrency(amount, currency)}</span>
              <span className="shrink-0 text-xs font-medium" style={{ color: daysUntil !== null ? getUpcomingBillDayColor(daysUntil) : undefined }}>
                {daysUntil !== null ? formatDaysUntil(daysUntil) : nextDue.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              {payment && onPay && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 shrink-0 px-2 text-xs"
                  aria-label={`Pay now: ${title}`}
                  onClick={() => onPay(payment)}
                >
                  Pay now
                </Button>
              )}
            </li>
          ))}
          {more > 0 && <li className="text-xs text-muted-foreground max-md:hidden md:self-center">+{more} more</li>}
        </ul>
      )}
    </section>
  )
}
