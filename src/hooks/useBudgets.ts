import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { readCache, writeCache } from '@/lib/dataCache'
import type { Budget, BudgetHistoryEntry } from '@/types'

function localDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getBudgetPeriodRange(period: Budget['period']): { start: string; end: string } {
  const now = new Date()
  if (period === 'weekly') {
    const dayOfWeek = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
    monday.setHours(0, 0, 0, 0)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    return {
      start: localDateStr(monday),
      end: localDateStr(sunday),
    }
  } else if (period === 'quarterly') {
    const q = Math.floor(now.getMonth() / 3)
    const startMonth = q * 3
    const start = new Date(now.getFullYear(), startMonth, 1)
    const end = new Date(now.getFullYear(), startMonth + 3, 0)
    return {
      start: localDateStr(start),
      end: localDateStr(end),
    }
  } else if (period === 'yearly') {
    return {
      start: `${now.getFullYear()}-01-01`,
      end: `${now.getFullYear()}-12-31`,
    }
  } else {
    // monthly
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return {
      start: localDateStr(start),
      end: localDateStr(end),
    }
  }
}

export function useBudgets() {
  const { user } = useAuth()
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    const cacheKey = `${user.id}:budgets`
    const cached = readCache<Budget[]>(cacheKey)
    if (cached) {
      setBudgets(cached)
      setLoading(false)
    } else {
      setLoading(true)
    }
    if (!navigator.onLine) return

    const { data: budgetData, error: budgetError } = await supabase
      .from('budgets')
      .select('*, category:categories(id, name, color, icon)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (budgetError) {
      setError(budgetError.message)
      setLoading(false)
      return
    }

    const budgets = budgetData as Budget[]

    // Fetch 13 months of expense transactions to cover history and rollover
    const now = new Date()
    const fetchStart = localDateStr(new Date(now.getFullYear(), now.getMonth() - 13, 1))
    const fetchEnd = localDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0))

    const { data: spentData, error: spentError } = await supabase
      .from('transactions')
      .select('category_id, amount, date, currency, exchange_rate')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .gte('date', fetchStart)
      .lte('date', fetchEnd)

    if (spentError) {
      setError(spentError.message)
      setLoading(false)
      return
    }

    const allTx = spentData ?? []
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const enriched = budgets.map((b) => {
      const { start, end } = getBudgetPeriodRange(b.period)

      const computeSpent = (rangeStart: string, rangeEnd: string) =>
        allTx.reduce((sum, tx) => {
          if (tx.category_id !== b.category_id) return sum
          if (tx.date < rangeStart || tx.date > rangeEnd) return sum
          const txAmount =
            tx.currency === b.currency
              ? tx.amount
              : tx.amount * (tx.exchange_rate ?? 1)
          return sum + txAmount
        }, 0)

      const spent = computeSpent(start, end)

      // Compute monthly rollover and history
      let rolloverAmount = 0
      const history: BudgetHistoryEntry[] = []

      if (b.period === 'monthly') {
        const budgetStartDate = new Date(b.start_date + 'T00:00:00')
        let d = new Date(budgetStartDate.getFullYear(), budgetStartDate.getMonth(), 1)

        while (d < currentMonthStart) {
          const periodStart = localDateStr(d)
          const periodEnd = localDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0))
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

          d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
        }
      }

      const recentHistory = history.slice(-6)
      const effectiveAmount = b.amount + (b.rollover_enabled ? rolloverAmount : 0)

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
  }, [user])

  useEffect(() => {
    queueMicrotask(() => {
      void fetch()
    })
  }, [fetch])

  const createBudget = async (
    values: Omit<Budget, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'category' | 'spent' | 'rollover_amount' | 'effective_amount' | 'history'>
  ) => {
    if (!user) return { error: 'Not authenticated' }
    const { error } = await supabase.from('budgets').insert({ ...values, user_id: user.id })
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  const updateBudget = async (id: string, values: Partial<Budget>) => {
    if (!user) return { error: 'Not authenticated' }
    const { error } = await supabase.from('budgets').update(values).eq('id', id).eq('user_id', user.id)
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  const deleteBudget = async (id: string) => {
    if (!user) return { error: 'Not authenticated' }
    const { error } = await supabase.from('budgets').delete().eq('id', id).eq('user_id', user.id)
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  return { budgets, loading, error, refetch: fetch, createBudget, updateBudget, deleteBudget }
}
