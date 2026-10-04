import { Pencil, RefreshCw } from 'lucide-react'
import { UnratedCurrencyNotice } from '@/components/UnratedCurrencyNotice'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { DeleteBudgetButton } from '@/components/budgets/DeleteBudgetButton'
import { canRollover } from '@/lib/budgetRollover'
import { spendWindowLabel } from '@/lib/overspending'
import { BUDGET_TONE_BAR_CLASS, budgetTone, budgetUsage } from '@/lib/budgetUsage'
import { cn, formatCurrency } from '@/lib/utils'
import type { MutationResult } from '@/lib/dataErrors'
import type { Budget } from '@/types'

// The md-and-up surface of the budget list (design 4b): one row per budget in the order
// it is given (the page sorts by % used). Below md the page draws the same budgets as cards.
export function BudgetTable({
  budgets,
  defaultCurrency,
  periodLabel,
  onSelect,
  onEdit,
  onDelete,
}: {
  budgets: Budget[]
  defaultCurrency: string
  periodLabel: (period: Budget['period']) => string
  onSelect: (budget: Budget) => void
  onEdit: (budget: Budget) => void
  onDelete: (budget: Budget) => Promise<MutationResult>
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <caption className="sr-only">Category budgets, sorted by percent used</caption>
        <thead>
          <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
            <th scope="col" className="px-4 py-2.5">Category</th>
            <th scope="col" className="px-4 py-2.5 text-right">Spent</th>
            <th scope="col" className="px-4 py-2.5 text-right">Budget</th>
            <th scope="col" className="w-56 px-4 py-2.5">Used</th>
            <th scope="col" className="w-20 px-2 py-2.5"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {budgets.map((budget) => {
            const spent = budget.spent ?? 0
            const effective = budget.effective_amount ?? budget.amount
            const { usedPct, barPct, over } = budgetUsage(spent, effective)
            const tone = budgetTone(barPct, over)
            const rollover = budget.rollover_amount ?? 0
            const rolloverActive = budget.rollover_enabled && canRollover(budget.period)
            const hasRollover = rolloverActive && rollover !== 0
            const spendWindow = spendWindowLabel(budget.period)
            return (
              <tr
                key={budget.id}
                onClick={() => onSelect(budget)}
                className="cursor-pointer border-b border-border last:border-b-0 hover:bg-accent/20"
              >
                <td className="min-w-0 px-4 py-3 align-top">
                  <div className="flex items-start gap-2">
                    {budget.category && <span className="text-lg leading-6" aria-hidden>{budget.category.icon}</span>}
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onSelect(budget)
                        }}
                        className="rounded-sm text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
                      >
                        {budget.name}
                      </button>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-xs">{periodLabel(budget.period)}</Badge>
                        {rolloverActive && (
                          <Badge variant="outline" className="gap-0.5 border-transfer/40 text-xs text-transfer">
                            <RefreshCw className="h-2.5 w-2.5" />Rollover
                          </Badge>
                        )}
                        {over && <Badge variant="destructive" className="text-xs">Over budget</Badge>}
                        {tone === 'gold' && (
                          <Badge variant="outline" className="border-warning/40 text-xs text-warning">Warning</Badge>
                        )}
                      </div>
                      {hasRollover && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Base {formatCurrency(budget.amount, budget.currency)}{' '}
                          {rollover >= 0 ? '+ surplus ' : '− debt '}
                          {formatCurrency(Math.abs(rollover), budget.currency)}
                        </p>
                      )}
                      {budget.currency !== defaultCurrency && (
                        <p className="mt-1 text-xs text-primary">
                          In {budget.currency}: other currencies are converted with their exchange rate.
                        </p>
                      )}
                      <UnratedCurrencyNotice currencies={budget.unrated_currencies ?? []} />
                    </div>
                  </div>
                </td>
                <td className={cn('px-4 py-3 text-right align-top tabular-nums', over && 'font-medium text-destructive')}>
                  {formatCurrency(spent, budget.currency)}
                  {spendWindow && <span className="block text-xs font-normal text-muted-foreground">{spendWindow}</span>}
                  {(budget.scheduled ?? 0) > 0 && (
                    <span className="block text-xs font-normal text-muted-foreground">+ {formatCurrency(budget.scheduled ?? 0, budget.currency)} scheduled</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right align-top tabular-nums">
                  {formatCurrency(effective, budget.currency)}
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="flex items-center gap-3">
                    <Progress value={barPct} className={cn('flex-1', BUDGET_TONE_BAR_CLASS[tone])} aria-label={`${budget.name} used`} />
                    <span className={cn('w-12 shrink-0 text-right font-medium tabular-nums', over ? 'text-destructive' : 'text-muted-foreground')}>
                      {usedPct === null ? 'Over' : `${usedPct}%`}
                    </span>
                  </div>
                </td>
                <td className="px-2 py-2.5 align-top">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label={`Edit ${budget.name}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        onEdit(budget)
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <DeleteBudgetButton name={budget.name} onDelete={() => onDelete(budget)} />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
