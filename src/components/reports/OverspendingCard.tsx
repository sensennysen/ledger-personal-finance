import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Info, TriangleAlert } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { InlineLoadError } from '@/components/ui/error-state'
import type { OverspendingReport } from '@/hooks/useOverspendingReport'
import { formatCurrency, formatDateShort, cn } from '@/lib/utils'
import { deficitSettingLabel, overspendingWindow, shiftMonthKey, streakLabel } from '@/lib/overspending'
import type { Category } from '@/types'
import { useCategoryInk } from '@/hooks/useCategoryInk'
import { UnratedCurrencyNotice } from '@/components/UnratedCurrencyNotice'

interface OverspendingCardProps {
  categories: Category[]
  /** Selected cycle as "YYYY-MM". */
  month: string
  /** From useOverspendingReport, which Reports calls once for this card and its stat card. */
  report: OverspendingReport
}

/**
 * D1b: the record of what went over budget, shown under either deficit
 * setting. Follows the global cycle chosen in the top-bar stepper (LED-21).
 */
export function OverspendingCard({ categories, month, report }: OverspendingCardProps) {
  const ink = useCategoryInk()
  const { range, result, converted, currency, state, refetch, behaviour } = report

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const nextMonthLabel = new Date(`${shiftMonthKey(month, 1)}-01T00:00:00`).toLocaleDateString(
    'en-US',
    { month: 'long' },
  )
  return (
    <Card className={cn('p-5 gap-3', result.rows.length > 0 && 'border-warning/50')}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="flex items-center gap-2 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-warning">
          <TriangleAlert className="w-4 h-4" />
          Overspending
        </span>
        <span className="text-xs text-muted-foreground">
          {formatDateShort(range.start)} – {formatDateShort(range.end)}
        </span>
      </div>

      {state === 'loading' && <Skeleton className="h-20 w-full" />}

      {state === 'error' && (
        <InlineLoadError
          message="Couldn't load your budgets, so overspending can't be shown."
          onRetry={() => void refetch()}
        />
      )}

      {state === 'stale-error' && (
        <InlineLoadError
          message="Couldn't refresh overspending; this may be out of date."
          onRetry={() => void refetch()}
        />
      )}

      {state === 'empty' && (
        <p className="text-sm text-muted-foreground">Set a budget to track overspending here.</p>
      )}

      {(state === 'ready' || state === 'stale-error') && result.rows.length === 0 && (
        <p className="text-sm text-muted-foreground">No category went over budget this cycle.</p>
      )}

      {(state === 'ready' || state === 'stale-error') && result.rows.length > 0 && (
        <div className="flex flex-col">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-4 py-2 border-t text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            <span>Category</span>
            <span className="text-right">Over by</span>
            <span className="text-right hidden sm:block w-24">Cycles</span>
          </div>
          {result.rows.map((row) => {
            const category = categoryById.get(row.categoryId)
            // Only a monthly row has a cycle streak; any other names its window instead (LED-244, LED-271)
            const spendWindow = overspendingWindow(row.period)
            return (
              <div
                key={row.budgetId}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 py-2.5 border-t"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-8 h-8 shrink-0 rounded-[10px] flex items-center justify-center text-sm"
                    style={{ backgroundColor: category ? `${ink(category.color)}22` : undefined }}
                  >
                    {category?.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium truncate">{category?.name ?? 'Uncategorised'}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {formatCurrency(row.spent, row.currency)} of {formatCurrency(row.limit, row.currency)}
                      {spendWindow ? <span className="whitespace-nowrap"> · {spendWindow.inline}</span> : <span className="sm:hidden"> · {streakLabel(row.streak)}</span>}
                    </span>
                  </span>
                </span>
                <span className="text-sm font-bold tabular-nums text-warning text-right">
                  {formatCurrency(row.over, row.currency)}
                </span>
                <span
                  className={cn(
                    'hidden sm:block w-24 justify-self-end text-center rounded-full px-2.5 py-0.5 text-[0.6875rem] font-bold',
                    row.streak > 1 && !spendWindow ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {spendWindow ? spendWindow.chip : streakLabel(row.streak)}
                </span>
              </div>
            )
          })}
          <div className="flex items-baseline justify-between border-t pt-3 mt-1">
            <span className="text-sm font-medium">Total over</span>
            <span className="text-base font-bold tabular-nums text-warning">
              {formatCurrency(converted.over, currency)}
            </span>
          </div>
          {converted.uncarried > 0 && (
            <div className="flex items-baseline justify-between pt-2">
              <span className="text-sm text-muted-foreground">Not carried into {nextMonthLabel}</span>
              <span className="text-sm font-semibold tabular-nums">
                {formatCurrency(converted.uncarried, currency)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Named, not converted at 1 (rules/foreign-currency-rate-of-one-is-not-a-rate) */}
      <UnratedCurrencyNotice currencies={converted.excludedCurrencies} subject="overspending" />

      {(state === 'ready' || state === 'stale-error') && (
        <div className="flex items-start gap-2.5 rounded-[14px] bg-muted px-3 py-2.5 text-xs leading-snug text-muted-foreground">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            Your setting is <strong className="text-foreground">{deficitSettingLabel(behaviour)}</strong>
            {behaviour === 'reset'
              ? `, so ${nextMonthLabel} opens at the full budget. This is the record of what was overspent. `
              : `, so an overspend lowers ${nextMonthLabel}'s budget. `}
            <Link to="/settings" className="font-semibold text-primary hover:underline">
              Change in Settings
            </Link>
          </span>
        </div>
      )}
    </Card>
  )
}
