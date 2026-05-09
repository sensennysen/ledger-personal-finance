import { CalendarClock, CreditCard } from 'lucide-react'
import { CORAL, EMERALD } from '@/constants/colors'
import { formatCurrency } from '@/lib/utils'
import type { CreditCardWithState } from '@/hooks/useDashboardData'
import { DashboardCardHeader } from '@/components/dashboard/DashboardCardHeader'
import { Progress } from '@/components/ui/progress'

interface DashboardCreditCardMonitorProps {
  creditCards: CreditCardWithState[]
  style?: React.CSSProperties
}

function formatCountdown(countdown: number | null) {
  if (countdown == null) return 'Not set'
  if (countdown === 0) return 'Today'
  return `in ${countdown} ${countdown === 1 ? 'day' : 'days'}`
}

export function DashboardCreditCardMonitor({
  creditCards,
  style,
}: DashboardCreditCardMonitorProps) {
  return (
    <div className="rounded-xl border border-border/60 p-5 bg-card space-y-4 lg:col-span-2" style={style}>
      <DashboardCardHeader
        title="Credit Card Monitor"
        subtitle="Spending, statement, and payment tracking"
        icon={<CreditCard className="w-3.5 h-3.5 text-muted-foreground" />}
        className="mb-0"
      />
      <div className="space-y-3">
        {creditCards.map((card) => (
          <div key={card.acc.id} className="rounded-lg border border-border/50 p-3.5 bg-muted/20 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{card.acc.name}</p>
                <p className="text-xs text-muted-foreground">
                  Spent {formatCurrency(card.spending, card.acc.currency)} of{' '}
                  {formatCurrency(card.acc.credit_limit ?? 0, card.acc.currency)}
                </p>
              </div>
              <p className="text-xs font-semibold" style={{ color: card.nearLimit ? CORAL : EMERALD }}>
                {card.utilizationPct.toFixed(1)}% used
              </p>
            </div>
            <Progress
              value={Math.min(card.utilizationPct, 100)}
              className={card.nearLimit ? '[&>div]:bg-[oklch(0.620_0.160_18)]' : '[&>div]:bg-[oklch(0.660_0.150_155)]'}
            />
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border border-border/40 px-2 py-1.5">
                <p className="text-muted-foreground">Statement</p>
                <p className="font-medium">{formatCountdown(card.statementCountdown)}</p>
              </div>
              <div className="rounded-md border border-border/40 px-2 py-1.5">
                <p className="text-muted-foreground">Due</p>
                <p className="font-medium">{formatCountdown(card.dueCountdown)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/40 px-2.5 py-2 text-xs">
              <span className="text-muted-foreground">Amount to pay</span>
              <span className="money font-semibold">{formatCurrency(card.amountToPay, card.acc.currency)}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/40 px-2.5 py-2 text-xs">
              <span className="text-muted-foreground">Remaining</span>
              <span className="money font-semibold" style={{ color: card.remainingToPay > 0 ? CORAL : EMERALD }}>
                {formatCurrency(card.remainingToPay, card.acc.currency)}
              </span>
            </div>
            {card.paymentReminder && (
              <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-2 text-xs text-amber-700 dark:text-amber-400">
                <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                Payment reminder: due in {card.dueCountdown} day(s)
              </div>
            )}
            {card.statementReminder && (
              <div className="flex items-center gap-2 rounded-md border border-sky-500/30 bg-sky-500/5 px-2.5 py-2 text-xs text-sky-700 dark:text-sky-300">
                <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                {card.statementCountdown === 0
                  ? 'Statement day is today'
                  : `Statement day in ${card.statementCountdown} day(s)`}
              </div>
            )}
            {card.acc.last_payment_date && card.acc.last_payment_amount != null && (
              <p className="text-[0.6875rem] text-muted-foreground">
                Last payment: {formatCurrency(card.acc.last_payment_amount, card.acc.currency)} on {card.acc.last_payment_date}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
