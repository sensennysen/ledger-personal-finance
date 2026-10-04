import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { OverspendingBudget } from '@/lib/overspending'
import type { BudgetSpendTx } from '@/lib/budgetSpend'
import { describeDataError, type DescribedError } from '@/lib/dataErrors'
import { readAllPages } from '@/lib/pagedRead'
import { readWithPolicy } from '@/lib/readRetry'

/**
 * Raw inputs for the Overspending report: active budgets and every expense
 * from the earliest budget start up to `until` (the end of the selected cycle),
 * so consecutive-cycle counts are never cut off at the start. Nothing after the
 * selected cycle can change its result, so it is not fetched. Read-only.
 */
export function useOverspending(until: string) {
  const { user } = useAuth()
  const [budgets, setBudgets] = useState<OverspendingBudget[]>([])
  const [txs, setTxs] = useState<BudgetSpendTx[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailure, setLoadFailure] = useState<DescribedError | null>(null)
  // The cycle end the loaded data covers; data for an earlier cycle must not be shown for a later one.
  const [loadedUntil, setLoadedUntil] = useState<string | null>(null)
  const requestId = useRef(0)
  // Once a load has landed, later reads are refreshes and keep the library retries (LED-242).
  const loadedOnce = useRef(false)

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    const request = ++requestId.current
    setLoading(true)
    setLoadFailure(null)

    const background = loadedOnce.current
    const { data: budgetData, error: budgetError } = await readWithPolicy((retry) => supabase
      .from('budgets')
      .select('id, category_id, amount, currency, period, start_date, rollover_enabled')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .retry(retry), { background })
    if (request !== requestId.current) return
    if (budgetError) {
      setLoadFailure(describeDataError(budgetError, { action: 'load' }))
      setLoading(false)
      return
    }
    const activeBudgets = (budgetData ?? []) as OverspendingBudget[]

    let all: BudgetSpendTx[] = []
    if (activeBudgets.length > 0) {
      const earliest = activeBudgets.map((b) => b.start_date).sort()[0].slice(0, 7) + '-01'
      const { rows, error: txError } = await readWithPolicy((retry) => readAllPages<BudgetSpendTx>(
        (from, to) =>
          supabase
            .from('transactions')
            .select('category_id, amount, date, currency, exchange_rate')
            .eq('user_id', user.id)
            .eq('type', 'expense')
            .gte('date', earliest)
            .lte('date', until)
            .order('date', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to)
            .retry(retry),
        undefined,
        () => request !== requestId.current,
      ), { background })
      if (request !== requestId.current) return
      if (txError) {
        setLoadFailure(describeDataError(txError, { action: 'load' }))
        setLoading(false)
        return
      }
      all = rows
    }

    setBudgets(activeBudgets)
    setTxs(all)
    setLoadedUntil(until)
    loadedOnce.current = true
    setLoading(false)
  }, [user, until])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  // Until data for this cycle arrives, expose nothing so the card shows its loading or error state.
  const fresh = loadedUntil === until
  const error = loadFailure?.message ?? null
  const errorDetail = loadFailure?.detail ?? null
  return {
    budgets: fresh ? budgets : [],
    txs: fresh ? txs : [],
    loading,
    error,
    errorDetail,
    refetch: load,
  }
}
