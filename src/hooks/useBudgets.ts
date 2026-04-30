import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Budget } from '@/types'
import { getMonthRange } from '@/lib/utils'

function buildSpentMap(
  spentData: { category_id: string | null; amount: number }[],
): Record<string, number> {
  const map: Record<string, number> = {}
  for (const tx of spentData) {
    if (tx.category_id) {
      map[tx.category_id] = (map[tx.category_id] ?? 0) + tx.amount
    }
  }
  return map
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
    setLoading(true)

    const { start, end } = getMonthRange()

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

    // Fetch spent amounts per category for current month
    const { data: spentData, error: spentError } = await supabase
      .from('transactions')
      .select('category_id, amount')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .gte('date', start)
      .lte('date', end)

    if (spentError) {
      setError(spentError.message)
      setLoading(false)
      return
    }

    const spentByCategory = buildSpentMap(spentData ?? [])

    const enriched = (budgetData as Budget[]).map((b) => ({
      ...b,
      spent: spentByCategory[b.category_id] ?? 0,
    }))

    setBudgets(enriched)
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
