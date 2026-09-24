import { CalendarClock, CreditCard } from 'lucide-react'
import { GOLD } from '@/constants/colors'
import { formatCurrency } from '@/lib/utils'
import { TONED_PROGRESS_CLASS, utilizationTone, utilizationToneStyle } from '@/lib/utilizationTone'
import type { CreditCardWithState } from '@/hooks/useDashboardData'
import { DashboardCardHeader } from '@/components/dashboard/DashboardCardHeader'
import { Progress } from '@/components/ui/progress'

interface DashboardCreditCardMonitorProps {
  creditCards: CreditCardWithState[]
  style?: React.CSSProperties
}

function formatCountdown(countdown: number | null) {
  if (countdown == null) return 'not set'
  if (countdown === 0) return 'today'
  return `in ${countdown} ${countdown === 1 ? 'day' : 'days'}`
}

// One card, one divided row per credit card (LED-77). Reminders are a single
// inline line in the app palette: gold means a liability is due.
export function DashboardCreditCardMonitor({
  creditCards,
  style,
}: DashboardCreditCardMonitorProps) {
  return (
    <div className="rounded-[20px] border border-border p-4 md:p-5 bg-card" style={style}>
      <DashboardCardHeader
        title="Credit Card Monitor"
        subtitle="Spending, statement, and payment tracking"
        icon={<CreditCard className="w-3.5 h-3.5 text-muted-foreground" />}
        className="mb-1"
      />
      <ul className="divide-y divide-border/60">
        {creditCards.map((card) => (
          <li key={card.acc.id} className="space-y-2 py-3 last:pb-0">
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{card.acc.name}</p>
                <p className="text-xs text-muted-foreground">
                  Spent {formatCurrency(card.spending, card.acc.currency)} of{' '}
                  {formatCurrency(card.acc.credit_limit ?? 0, card.acc.currency)}
                </p>
              </div>
              <p className="shrink-0 text-xs font-semibold" style={{ color: utilizationTone(card.utilizationPct, card.targetPct) }}>
                {card.utilizationPct.toFixed(1)}% used
              </p>
            </div>
            <Progress
              value={Math.min(card.utilizationPct, 100)}
              aria-label={`${card.acc.name} utilisation`}
              className={TONED_PROGRESS_CLASS}
              style={utilizationToneStyle(card.utilizationPct, card.targetPct) as React.CSSProperties}
            />
            <p className="text-xs text-muted-foreground">
              Statement {formatCountdown(card.statementCountdown)} · Due {formatCountdown(card.dueCountdown)} · To pay{' '}
              <span className="money font-medium text-foreground">{formatCurrency(card.amountToPay, card.acc.currency)}</span>
              {card.amountToPay > 0 && (
                <>
                  {' '}· Remaining{' '}
                  <span className="money font-medium text-foreground">{formatCurrency(card.remainingToPay, card.acc.currency)}</span>
                </>
              )}
            </p>
            {(card.paymentReminder || card.statementReminder) && (
              <p className="flex items-center gap-1.5 text-xs font-medium" style={{ color: card.paymentReminder ? GOLD : undefined }}>
                <CalendarClock className="w-3.5 h-3.5 shrink-0" aria-hidden />
                {[
                  card.paymentReminder && `Payment due ${formatCountdown(card.dueCountdown)}`,
                  card.statementReminder && `Statement closes ${formatCountdown(card.statementCountdown)}`,
                ].filter(Boolean).join(' · ')}
              </p>
            )}
            {card.acc.last_payment_date && card.acc.last_payment_amount != null && (
              <p className="text-[0.6875rem] text-muted-foreground">
                Last payment: {formatCurrency(card.acc.last_payment_amount, card.acc.currency)} on {card.acc.last_payment_date}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
