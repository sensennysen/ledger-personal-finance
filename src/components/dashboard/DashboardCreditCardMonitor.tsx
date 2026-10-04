import { CalendarClock, CreditCard } from 'lucide-react'
import { WARNING_INK } from '@/constants/colors'
import { formatCurrency } from '@/lib/utils'
import { TONED_PROGRESS_CLASS, utilizationToneStyle } from '@/lib/utilizationTone'
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
        subtitleOnPhone={false}
        icon={<CreditCard className="w-3.5 h-3.5 text-muted-foreground" />}
        iconOnPhone={false}
        className="mb-1 max-md:hidden"
      />
      {/* Phones (M-08): a short title and the count. */}
      <div className="mb-1 flex items-baseline justify-between gap-3 md:hidden">
        <h3 className="text-[0.9375rem] font-semibold">Credit cards</h3>
        <span className="text-xs text-muted-foreground">
          {creditCards.length} {creditCards.length === 1 ? 'card' : 'cards'}
        </span>
      </div>
      <ul className="divide-y divide-border/60">
        {creditCards.map((card) => (
          <li key={card.acc.id} className="space-y-2 py-3 last:pb-0 max-md:first:pt-2">
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{card.acc.name}</p>
                <p className="text-xs text-muted-foreground">
                  Spent {formatCurrency(card.spending, card.acc.currency)} of{' '}
                  {formatCurrency(card.acc.credit_limit ?? 0, card.acc.currency)}
                </p>
              </div>
              <p className="shrink-0 text-xs font-semibold text-foreground">
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
              <p className="flex items-center gap-1.5 text-xs font-medium" style={{ color: card.paymentReminder ? WARNING_INK : undefined }}>
                <CalendarClock className="w-3.5 h-3.5 shrink-0" aria-hidden />
                {[
                  card.paymentReminder && `Payment due ${formatCountdown(card.dueCountdown)}`,
                  card.statementReminder && `Statement closes ${formatCountdown(card.statementCountdown)}`,
                ].filter(Boolean).join(' · ')}
              </p>
            )}
            {card.acc.last_payment_date && card.acc.last_payment_amount != null && (
              <p className="text-[0.6875rem] text-muted-foreground max-md:hidden">
                Last payment: {formatCurrency(card.acc.last_payment_amount, card.acc.currency)} on {card.acc.last_payment_date}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
