import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { readCache, writeCache } from '@/lib/dataCache'
import type { Budget, BudgetHistoryEntry } from '@/types'
import { getCurrentCycleMonthKey } from '@/lib/utils'
import { getBudgetCycleRange } from '@/lib/budgetCycle'
import { sumBudgetSpend } from '@/lib/budgetSpend'
import { readAllPages } from '@/lib/pagedRead'
import { canRollover, nextRollover, type DeficitBehaviour } from '@/lib/budgetRollover'
import { useDeficitBehaviour } from '@/hooks/useDeficitBehaviour'
import { resolveRefresh } from '@/lib/loadState'
import { describeDataError, toResult, type DescribedError, type MutationResult } from '@/lib/dataErrors'

function localDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function useBudgets(
  cycle?: {
    selectedMonth: string
    startDay: number
  },
  deficitOverride?: DeficitBehaviour,
) {
  const { user } = useAuth()
  const profileDeficitBehaviour = useDeficitBehaviour()
  // null = profile still loading; wait rather than computing rollover with a guessed setting.
  const deficitBehaviour = deficitOverride ?? profileDeficitBehaviour
  const selectedMonth = cycle?.selectedMonth
  const startDay = cycle?.startDay ?? 1
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailure, setLoadFailure] = useState<DescribedError | null>(null)
  // Cycle key the budgets on screen were read for; differs from the requested
  // key while a new cycle loads with the previous one still showing.
  const [dataKey, setDataKey] = useState<string | null>(null)
  const dataKeyRef = useRef<string | null>(null)
  const requestId = useRef(0)
  const requestedKey = selectedMonth ? `${selectedMonth}:${startDay}` : 'current'

  const showBudgets = useCallback((next: Budget[], key: string | null) => {
    setBudgets(next)
    setDataKey(key)
    dataKeyRef.current = key
  }, [])

  const fetch = useCallback(async () => {
    const request = ++requestId.current
    setLoadFailure(null)
    if (!user) {
      setLoading(false)
      return
    }
    if (!deficitBehaviour) {
      setLoading(true)
      return
    }
    const key = selectedMonth ? `${selectedMonth}:${startDay}` : 'current'
    const cacheKey = `${user.id}:budgets${selectedMonth ? `:${selectedMonth}:${startDay}` : ''}:${deficitBehaviour}`
    const cached = readCache<Budget[]>(cacheKey)
    if (cached) {
      showBudgets(cached, key)
      setLoading(false)
    } else {
      // Keep the previous cycle on screen while this one loads (LED-95).
      setLoading(true)
    }
    // A failed read for a new cycle must not leave the old cycle posing as it.
    const failNewCycle = (failure: DescribedError | null) => {
      if (dataKeyRef.current !== key) showBudgets([], null)
      setLoadFailure(failure)
      setLoading(false)
    }
    if (!navigator.onLine) {
      if (!cached) failNewCycle({ message: 'Budgets for this cycle are not cached. Reconnect to load them.', detail: null })
      else setLoading(false)
      return
    }

    const { data: budgetData, error: budgetError } = await supabase
      .from('budgets')
      .select('*, category:categories(id, name, color, icon)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (request !== requestId.current) return
    if (budgetError) {
      failNewCycle(describeDataError(budgetError, { action: 'load' }))
      return
    }

    const budgets = budgetData as Budget[]

    // Fetch 13 months of expense transactions to cover history and rollover
    const now = selectedMonth
      ? new Date(
          `${selectedMonth}-${String(startDay).padStart(2, '0')}T00:00:00`,
        )
      : new Date()
    const fetchStart = localDateStr(
      new Date(now.getFullYear(), now.getMonth() - 13, 1),
    )
    const fetchEnd = localDateStr(
      new Date(now.getFullYear() + 1, 0, Math.max(1, startDay - 1)),
    )

    const { rows: spentData, error: spentError } = await readAllPages((from, to) =>
      supabase
        .from('transactions')
        .select('category_id, amount, date, currency, exchange_rate')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .gte('date', fetchStart)
        .lte('date', fetchEnd)
        .order('date', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    )

    if (request !== requestId.current) return
    if (spentError) {
      failNewCycle(describeDataError(spentError, { action: 'load' }))
      return
    }

    const allTx = spentData
    const currentMonthStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      startDay,
    )

    const enriched = budgets.map((b) => {
      const { start, end } = getBudgetCycleRange(
        b.period,
        selectedMonth ?? getCurrentCycleMonthKey(startDay),
        startDay,
      )

      const computeSpent = (rangeStart: string, rangeEnd: string) =>
        sumBudgetSpend(allTx, b, rangeStart, rangeEnd)

      const { spent, unrated } = computeSpent(start, end)

      // Compute monthly rollover and history
      const rolloverActive = b.rollover_enabled && canRollover(b.period)
      let rolloverAmount = 0
      const history: BudgetHistoryEntry[] = []

      if (canRollover(b.period)) {
        const budgetStartDate = new Date(b.start_date + 'T00:00:00')
        let d = new Date(
          budgetStartDate.getFullYear(),
          budgetStartDate.getMonth(),
          startDay,
        )

        while (d < currentMonthStart) {
          const periodStart = localDateStr(d)
          const periodEnd = localDateStr(
            new Date(d.getFullYear(), d.getMonth() + 1, startDay - 1),
          )
          const { spent: periodSpent } = computeSpent(periodStart, periodEnd)
          const surplus = b.amount - periodSpent

          history.push({
            period_start: periodStart,
            period_end: periodEnd,
            budget_amount: b.amount,
            spent_amount: periodSpent,
            rollover_in: rolloverActive ? rolloverAmount : 0,
            currency: b.currency,
          })

          if (rolloverActive) {
            rolloverAmount = nextRollover(
              rolloverAmount,
              surplus,
              b.amount,
              deficitBehaviour,
            )
          }

          d = new Date(d.getFullYear(), d.getMonth() + 1, startDay)
        }
      }

      const recentHistory = history.slice(-6)
      const effectiveAmount = Math.max(
        0,
        b.amount + (rolloverActive ? rolloverAmount : 0),
      )

      return {
        ...b,
        spent,
        unrated_currencies: unrated,
        rollover_amount: rolloverAmount,
        effective_amount: effectiveAmount,
        history: recentHistory,
      }
    })

    showBudgets(enriched, key)
    writeCache(cacheKey, enriched)
    setLoading(false)
  }, [user, selectedMonth, startDay, deficitBehaviour, showBudgets])

  useEffect(() => {
    queueMicrotask(() => {
      void fetch()
    })
  }, [fetch])

  const createBudget = async (
    values: Omit<
      Budget,
      | 'id'
      | 'user_id'
      | 'created_at'
      | 'updated_at'
      | 'category'
      | 'spent'
      | 'unrated_currencies'
      | 'rollover_amount'
      | 'effective_amount'
      | 'history'
    >,
  ): Promise<MutationResult> => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) return { error: 'Connect to the internet to add a budget.' }
    const { error } = await supabase
      .from('budgets')
      .insert({ ...values, user_id: user.id })
    if (!error) await fetch()
    return toResult(error, { action: 'save', entity: 'budget' })
  }

  const updateBudget = async (id: string, values: Partial<Budget>): Promise<MutationResult> => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) return { error: 'Connect to the internet to edit this budget.' }
    const { error } = await supabase
      .from('budgets')
      .update(values)
      .eq('id', id)
      .eq('user_id', user.id)
    if (!error) await fetch()
    return toResult(error, { action: 'save', entity: 'budget' })
  }

  const deleteBudget = async (id: string): Promise<MutationResult> => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) return { error: 'Connect to the internet to remove this budget.' }
    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (!error) await fetch()
    return toResult(error, { action: 'delete', entity: 'budget' })
  }

  const { refreshing } = resolveRefresh({
    loading,
    hasData: budgets.length > 0,
    dataKey,
    requestedKey,
  })

  const error = loadFailure?.message ?? null
  const errorDetail = loadFailure?.detail ?? null
  return {
    budgets,
    loading,
    /** Previous cycle's budgets are on screen while the selected one loads. */
    refreshing,
    error,
    errorDetail,
    refetch: fetch,
    createBudget,
    updateBudget,
    deleteBudget,
  }
}
