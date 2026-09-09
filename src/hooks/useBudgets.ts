import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useExchangeRates } from '@/hooks/useExchangeRates'
import { readCache, writeCache } from '@/lib/dataCache'
import type { Budget, BudgetHistoryEntry } from '@/types'
import { getCurrentCycleMonthKey } from '@/lib/utils'
import { convertAmount } from '@/lib/currency'
import { getBudgetCycleRange } from '@/lib/budgetCycle'

function localDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function useBudgets(cycle?: {
  selectedMonth: string
  startDay: number
}) {
  const { user } = useAuth()
  const { rates } = useExchangeRates()
  const selectedMonth = cycle?.selectedMonth
  const startDay = cycle?.startDay ?? 1
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const fetch = useCallback(async () => {
    const request = ++requestId.current
    setError(null)
    if (!user) {
      setLoading(false)
      return
    }
    const cacheKey = `${user.id}:budgets${selectedMonth ? `:${selectedMonth}:${startDay}` : ''}`
    const cached = readCache<Budget[]>(cacheKey)
    if (cached) {
      setBudgets(cached)
      setLoading(false)
    } else {
      setBudgets([])
      setLoading(true)
    }
    if (!navigator.onLine) {
      if (!cached) setError('Budgets for this cycle are not cached. Reconnect to load them.')
      setLoading(false)
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
      setError(budgetError.message)
      setLoading(false)
      return
    }

    const budgets = budgetData as Budget[]

    // Fetch 13 months of expense transactions to cover history and rollover
    const now = selectedMonth
      ? new Date(
          `${selectedMonth}-${String(startDay).padStart(2, '0')}T00:00:00`,
        )
      : new Date()
    const fetchStartDate = new Date(now.getFullYear(), now.getMonth() - 13, 1)
    const fetchStart = localDateStr(fetchStartDate)
    const fetchEnd = localDateStr(
      new Date(now.getFullYear() + 1, 0, Math.max(1, startDay - 1)),
    )

    const { data: spentData, error: spentError } = await supabase
      .from('transactions')
      .select('category_id, amount, date, currency')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .gte('date', fetchStart)
      .lte('date', fetchEnd)

    if (request !== requestId.current) return
    if (spentError) {
      setError(spentError.message)
      setLoading(false)
      return
    }

    const allTx = spentData ?? []
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
        allTx.reduce((sum, tx) => {
          if (tx.category_id !== b.category_id) return sum
          if (tx.date < rangeStart || tx.date > rangeEnd) return sum
          // Convert each transaction into the budget's own currency via the
          // USD-anchored rate map. Spend in a currency with no rate is left out.
          const amount = convertAmount(tx.amount, tx.currency, b.currency, rates)
          return amount === null ? sum : sum + amount
        }, 0)

      const spent = computeSpent(start, end)

      // Compute monthly rollover and history
      let rolloverAmount = 0
      const history: BudgetHistoryEntry[] = []

      if (b.period === 'monthly') {
        const budgetStartDate = new Date(b.start_date + 'T00:00:00')
        let d = new Date(
          budgetStartDate.getFullYear(),
          budgetStartDate.getMonth(),
          startDay,
        )

        // We only fetched spend data back to `fetchStartDate`. Iterating from an
        // older budget start would see zero spend for every un-fetched month and
        // wrongly bank the full budget amount as surplus, massively inflating the
        // rollover. Clamp the loop start to the fetched window.
        const earliestComputable = new Date(
          fetchStartDate.getFullYear(),
          fetchStartDate.getMonth(),
          startDay,
        )
        if (d < earliestComputable) d = earliestComputable

        while (d < currentMonthStart) {
          const periodStart = localDateStr(d)
          const periodEnd = localDateStr(
            new Date(d.getFullYear(), d.getMonth() + 1, startDay - 1),
          )
          const periodSpent = computeSpent(periodStart, periodEnd)
          const surplus = b.amount - periodSpent

          history.push({
            period_start: periodStart,
            period_end: periodEnd,
            budget_amount: b.amount,
            spent_amount: periodSpent,
            rollover_in: b.rollover_enabled ? rolloverAmount : 0,
            currency: b.currency,
          })

          if (b.rollover_enabled) {
            rolloverAmount += surplus
          }

          d = new Date(d.getFullYear(), d.getMonth() + 1, startDay)
        }
      }

      const recentHistory = history.slice(-6)
      const effectiveAmount =
        b.amount + (b.rollover_enabled ? rolloverAmount : 0)

      return {
        ...b,
        spent,
        rollover_amount: rolloverAmount,
        effective_amount: effectiveAmount,
        history: recentHistory,
      }
    })

    setBudgets(enriched)
    writeCache(cacheKey, enriched)
    setLoading(false)
  }, [user, selectedMonth, startDay, rates])

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
      | 'rollover_amount'
      | 'effective_amount'
      | 'history'
    >,
  ) => {
    if (!user) return { error: 'Not authenticated' }
    const { error } = await supabase
      .from('budgets')
      .insert({ ...values, user_id: user.id })
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  const updateBudget = async (id: string, values: Partial<Budget>) => {
    if (!user) return { error: 'Not authenticated' }
    const { error } = await supabase
      .from('budgets')
      .update(values)
      .eq('id', id)
      .eq('user_id', user.id)
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  const deleteBudget = async (id: string) => {
    if (!user) return { error: 'Not authenticated' }
    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  return {
    budgets,
    loading,
    error,
    refetch: fetch,
    createBudget,
    updateBudget,
    deleteBudget,
  }
}
