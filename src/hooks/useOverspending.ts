import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { OverspendingBudget } from '@/lib/overspending'
import type { BudgetSpendTx } from '@/lib/budgetSpend'

const PAGE = 1000

/**
 * Raw inputs for the Overspending report: active budgets and every expense
 * since the earliest budget started, so consecutive-cycle counts are never
 * cut off by a fetch window. Read-only; there is no write path.
 */
export function useOverspending() {
  const { user } = useAuth()
  const [budgets, setBudgets] = useState<OverspendingBudget[]>([])
  const [txs, setTxs] = useState<BudgetSpendTx[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const load = useCallback(async () => {
    if (!user) return
    const request = ++requestId.current
    setLoading(true)
    setError(null)

    const { data: budgetData, error: budgetError } = await supabase
      .from('budgets')
      .select('id, category_id, amount, currency, period, start_date, rollover_enabled')
      .eq('user_id', user.id)
      .eq('is_active', true)
    if (request !== requestId.current) return
    if (budgetError) {
      setError(budgetError.message)
      setLoading(false)
      return
    }
    const activeBudgets = (budgetData ?? []) as OverspendingBudget[]

    const all: BudgetSpendTx[] = []
    if (activeBudgets.length > 0) {
      const earliest = activeBudgets.map((b) => b.start_date).sort()[0].slice(0, 7) + '-01'
      for (let from = 0; ; from += PAGE) {
        const { data, error: txError } = await supabase
          .from('transactions')
          .select('category_id, amount, date, currency, exchange_rate')
          .eq('user_id', user.id)
          .eq('type', 'expense')
          .gte('date', earliest)
          .order('date', { ascending: true })
          .order('id', { ascending: true })
          .range(from, from + PAGE - 1)
        if (request !== requestId.current) return
        if (txError) {
          setError(txError.message)
          setLoading(false)
          return
        }
        all.push(...((data ?? []) as BudgetSpendTx[]))
        if (!data || data.length < PAGE) break
      }
    }

    setBudgets(activeBudgets)
    setTxs(all)
    setLoading(false)
  }, [user])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  return { budgets, txs, loading, error, refetch: load }
}
