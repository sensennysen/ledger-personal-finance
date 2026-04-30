import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { readCache, writeCache } from '@/lib/dataCache'
import type { Budget } from '@/types'

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
      start: monday.toISOString().split('T')[0],
      end: sunday.toISOString().split('T')[0],
    }
  } else if (period === 'quarterly') {
    const q = Math.floor(now.getMonth() / 3)
    const startMonth = q * 3
    const start = new Date(now.getFullYear(), startMonth, 1)
    const end = new Date(now.getFullYear(), startMonth + 3, 0)
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
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
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
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

    // Fetch all expense transactions for the current year (covers all period types)
    const now = new Date()
    const yearStart = `${now.getFullYear()}-01-01`
    const yearEnd = `${now.getFullYear()}-12-31`

    const { data: spentData, error: spentError } = await supabase
      .from('transactions')
      .select('category_id, amount, date')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .gte('date', yearStart)
      .lte('date', yearEnd)

    if (spentError) {
      setError(spentError.message)
      setLoading(false)
      return
    }

    const allTx = spentData ?? []

    // For each budget, compute spending within its own period's date range
    const enriched = budgets.map((b) => {
      const { start, end } = getBudgetPeriodRange(b.period)
      const spent = allTx.reduce((sum, tx) => {
        if (tx.category_id !== b.category_id) return sum
        if (tx.date < start || tx.date > end) return sum
        return sum + tx.amount
      }, 0)
      return { ...b, spent }
    })

    setBudgets(enriched)
    writeCache(cacheKey, enriched)
    setLoading(false)
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  const createBudget = async (
    values: Omit<Budget, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'category' | 'spent'>
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
