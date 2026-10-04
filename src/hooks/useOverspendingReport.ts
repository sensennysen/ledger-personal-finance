import { useMemo } from 'react'
import { useOverspending } from '@/hooks/useOverspending'
import { resolveLoadState } from '@/lib/loadState'
import { monthCycleRange } from '@/lib/cycleRange'
import { getBudgetCycleRange } from '@/lib/budgetCycle'
import { computeOverspending, convertOverspendingTotals, shiftMonthKey } from '@/lib/overspending'
import type { DeficitBehaviour } from '@/lib/budgetRollover'
import { useExchangeRates } from '@/contexts/exchangeRatesState'
import { useAuth } from '@/contexts/AuthContext'
import { getLocalDateString } from '@/lib/utils'
import { likeForLikeWindows } from '@/lib/periodCompare'

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
  const { table: rates, loading: ratesLoading } = useExchangeRates()
  const currency = useAuth().profile?.default_currency ?? 'USD'

  // A row dated after today is scheduled and not over anything yet (LED-238).
  const today = getLocalDateString()
  const compute = (forMonth: string, countUntil: string) =>
    computeOverspending({
      budgets,
      txs,
      month: forMonth,
      startDay,
      behaviour,
      rangeFor: (period) => getBudgetCycleRange(period, forMonth, startDay),
      rates,
      countUntil,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `compute` only closes over the listed inputs
  const result = useMemo(() => compute(month, today), [budgets, txs, month, startDay, behaviour, rates, today])
  // Like for like (LED-237): while this cycle is open, the previous one counts only its first N days.
  const previousMonth = shiftMonthKey(month, -1)
  const previousUntil = likeForLikeWindows(range, monthCycleRange(previousMonth, startDay), today).previous.end
  // eslint-disable-next-line react-hooks/exhaustive-deps -- as above
  const previous = useMemo(() => compute(previousMonth, previousUntil), [budgets, txs, previousMonth, previousUntil, startDay, behaviour, rates])

  // One total in the default currency for the card and the stat card (LED-185), never "A + B".
  const converted = useMemo(() => convertOverspendingTotals(result, currency, rates), [result, currency, rates])
  const previousConverted = useMemo(() => convertOverspendingTotals(previous, currency, rates), [previous, currency, rates])

  const state = resolveLoadState({
    loading: loading || ratesLoading || !deficitBehaviour,
    error,
    hasData: budgets.length > 0 && Boolean(deficitBehaviour),
  })

  return { range, result, previous, converted, previousConverted, currency, state, error, refetch, behaviour }
}

export type OverspendingReport = ReturnType<typeof useOverspendingReport>
