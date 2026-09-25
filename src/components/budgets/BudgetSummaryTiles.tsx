import { cn, formatCurrency } from '@/lib/utils'
import type { BudgetSummary } from '@/lib/budgetSummary'

// The cycle's totals from design 4b: four tiles from sm up, one "Remaining" hero on a phone.
// Only monthly budgets in `currency` are added; the note says what was left out.
export function BudgetSummaryTiles({
  summary,
  currency,
  daysLeft,
}: {
  summary: BudgetSummary
  currency: string
  /** Null when the cycle on screen is not the current one. */
  daysLeft: number | null
}) {
  const usedPct = summary.budgeted > 0 ? Math.round((summary.spent / summary.budgeted) * 100) : null
  const left = daysLeft === null ? null : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`
  const over = summary.overCount > 0
  const overNames = summary.overNames.join(', ')
  const remainingTone = summary.remaining < 0 ? 'text-expense' : ''
  const omitted = [
    summary.otherCurrency > 0 &&
      `${summary.otherCurrency} ${summary.otherCurrency === 1 ? 'budget' : 'budgets'} in another currency`,
    summary.otherPeriod > 0 &&
      `${summary.otherPeriod} weekly, quarterly or yearly ${summary.otherPeriod === 1 ? 'budget' : 'budgets'}`,
  ].filter(Boolean)

  return (
    <section aria-label="Budget summary" className="space-y-2">
      <div className="hidden grid-cols-2 gap-3 sm:grid lg:grid-cols-4">
        <Tile label="Budgeted this cycle" value={formatCurrency(summary.budgeted, currency)}>
          across {summary.counted} {summary.counted === 1 ? 'category' : 'categories'}
        </Tile>
        <Tile label="Spent" value={formatCurrency(summary.spent, currency)}>
          {usedPct === null ? 'no budget set' : `${usedPct}% of plan`}
        </Tile>
        <Tile label="Remaining" value={formatCurrency(summary.remaining, currency)} valueClassName={remainingTone}>
          {left ?? 'this cycle'}
        </Tile>
        <Tile
          label="Over budget"
          value={String(summary.overCount)}
          className="border-gold"
          valueClassName={over ? 'text-expense' : ''}
        >
          {over ? overNames : 'nothing over'}
        </Tile>
      </div>
      <div className="rounded-xl border border-border bg-card p-4 sm:hidden">
        <p className="text-xs font-medium text-muted-foreground">Remaining this cycle</p>
        <p className={cn('mt-1 text-3xl font-bold tabular-nums', remainingTone)}>
          {formatCurrency(summary.remaining, currency)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatCurrency(summary.spent, currency)} spent of {formatCurrency(summary.budgeted, currency)}
          {left ? ` · ${left}` : ''}
        </p>
        {over && (
          <p className="mt-3 rounded-lg border border-gold px-3 py-2 text-sm">
            <span className="font-semibold">
              {summary.overCount} {summary.overCount === 1 ? 'category' : 'categories'} over
            </span>{' '}
            — {overNames}
          </p>
        )}
      </div>
      {omitted.length > 0 && (
        <p className="text-xs text-muted-foreground">Not included in these totals: {omitted.join(' and ')}.</p>
      )}
    </section>
  )
}

function Tile({
  label,
  value,
  children,
  className,
  valueClassName,
}: {
  label: string
  value: string
  children: React.ReactNode
  className?: string
  valueClassName?: string
}) {
  return (
    <div className={cn('min-w-0 rounded-xl border border-border bg-card p-4', className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn('mt-1 truncate text-2xl font-bold tabular-nums', valueClassName)}>{value}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{children}</p>
    </div>
  )
}
