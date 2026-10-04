import { useEffect, useMemo, useRef } from 'react'
import { Check } from 'lucide-react'
import { InlineLoadError } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { useLoanPurchases } from '@/hooks/useLoanPurchases'
import { monthCycleRange } from '@/lib/cycleRange'
import { resolveLoadState } from '@/lib/loadState'
import { getLoanDeadlines } from '@/lib/loanInstallments'
import { nextDeadlineInCycle, sortLoanChoices, type LoanChoice } from '@/lib/loanPicker'
import { formatLoanSchedule, getLoanAmountOwed } from '@/lib/loans'
import { cn, formatCurrency, formatDateShort, getCurrentCycleMonthKey } from '@/lib/utils'
import type { Account } from '@/types'

interface LoanPickerProps {
  loans: Account[]
  selectedLoanId: string | null
  onChoose: (loanId: string) => void
  /** True when the picker is coming back from the form: focus its heading, since the dialog title is not the target then. */
  restoreFocus?: boolean
}

export function LoanPicker({ loans, selectedLoanId, onChoose, restoreFocus = false }: LoanPickerProps) {
  const { profile } = useAuth()
  const { purchases, allocations, loading, error, refetch } = useLoanPurchases()
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (restoreFocus) headingRef.current?.focus()
  }, [restoreFocus])

  const choices = useMemo(() => {
    const startDay = profile?.month_start_day ?? 1
    const cycleEnd = monthCycleRange(getCurrentCycleMonthKey(startDay), startDay).end
    return sortLoanChoices(
      loans.map<LoanChoice>((loan) => {
        const deadline = nextDeadlineInCycle(
          getLoanDeadlines(purchases.filter((purchase) => purchase.account_id === loan.id), allocations),
          cycleEnd,
        )
        return {
          id: loan.id,
          name: loan.name,
          schedule: formatLoanSchedule(loan),
          outstanding: getLoanAmountOwed(loan),
          nextDeadline: deadline ? { date: deadline.dueDate, amount: deadline.total } : null,
        }
      }),
    )
  }, [allocations, loans, profile?.month_start_day, purchases])

  const loadState = resolveLoadState({ loading, error, hasData: purchases.length > 0 })
  // A failed read must not read as "nothing due": the rows stay selectable but say the date is unknown.
  const deadlinesKnown = loadState !== 'error'
  const currencyOf = (loanId: string) => loans.find((loan) => loan.id === loanId)?.currency

  return (
    <div className="space-y-3">
      <h3 ref={headingRef} tabIndex={-1} className="text-sm font-medium outline-none">
        Which loan are you repaying?
      </h3>
      {(loadState === 'error' || loadState === 'stale-error') && error && (
        <InlineLoadError message={error} onRetry={() => void refetch()} />
      )}
      {loadState === 'loading' ? (
        <div className="space-y-2">
          {[0, 1].map((item) => <Skeleton key={item} className="h-20 rounded-lg" />)}
        </div>
      ) : (
        <ul className="space-y-2">
          {choices.map((choice) => {
            const currency = currencyOf(choice.id)
            const selected = choice.id === selectedLoanId
            return (
              <li key={choice.id}>
                <button
                  type="button"
                  onClick={() => onChoose(choice.id)}
                  aria-current={selected ? 'true' : undefined}
                  className={cn(
                    'flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected ? 'border-primary bg-primary/5' : 'border-border/70',
                  )}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="truncate">{choice.name}</span>
                      {selected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Selected" />}
                    </span>
                    {choice.schedule && <span className="block text-xs text-muted-foreground">{choice.schedule}</span>}
                    <span className="block text-xs text-muted-foreground">
                      {!deadlinesKnown
                        ? 'Due date unavailable'
                        : choice.nextDeadline
                          ? `Next ${formatCurrency(choice.nextDeadline.amount, currency)} on ${formatDateShort(choice.nextDeadline.date)}`
                          : 'Nothing due this cycle'}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold">{formatCurrency(choice.outstanding, currency)}</span>
                    <span className="block text-xs text-muted-foreground">outstanding</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
