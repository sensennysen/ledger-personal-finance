import { useMemo } from 'react'
import { useOverspending } from '@/hooks/useOverspending'
import { resolveLoadState } from '@/lib/loadState'
import { monthCycleRange } from '@/lib/cycleRange'
import { getBudgetCycleRange } from '@/lib/budgetCycle'
import { computeOverspending, shiftMonthKey } from '@/lib/overspending'
import type { DeficitBehaviour } from '@/lib/budgetRollover'

/**
 * The Overspending report for the selected cycle and the one before it, from one
 * read. The card and the "Over budget" stat card both take this, so Reports
 * makes one call and the two can never disagree.
 */
export function useOverspendingReport({
  startDay,
  month,
  deficitBehaviour,
}: {
  startDay: number
  month: string
  /** Null while the profile is still loading; the report waits instead of guessing. */
  deficitBehaviour: DeficitBehaviour | null
}) {
  const behaviour: DeficitBehaviour = deficitBehaviour ?? 'carry'
  const range = monthCycleRange(month, startDay)
  const { budgets, txs, loading, error, refetch } = useOverspending(range.end)

  const compute = (forMonth: string) =>
    computeOverspending({
      budgets,
      txs,
      month: forMonth,
      startDay,
      behaviour,
      rangeFor: (period) => getBudgetCycleRange(period, forMonth, startDay),
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `compute` only closes over the listed inputs
  const result = useMemo(() => compute(month), [budgets, txs, month, startDay, behaviour])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- as above
  const previous = useMemo(() => compute(shiftMonthKey(month, -1)), [budgets, txs, month, startDay, behaviour])

  const state = resolveLoadState({
    loading: loading || !deficitBehaviour,
    error,
    hasData: budgets.length > 0 && Boolean(deficitBehaviour),
  })

  return { range, result, previous, state, error, refetch, behaviour }
}

export type OverspendingReport = ReturnType<typeof useOverspendingReport>
