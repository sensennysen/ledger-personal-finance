import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { describeDataError, type DescribedError } from '@/lib/dataErrors'

/**
 * Category id -> the id of its (first) active budget. Just enough for the
 * search palette to offer "Edit the budget"; none of the cycle maths useBudgets
 * does. Offline it stays empty without an error: editing a budget needs the
 * network anyway, and the offline banner already says so.
 */
export function useBudgetIndex(enabled: boolean) {
  const { user } = useAuth()
  const [budgetByCategory, setBudgetByCategory] = useState<Map<string, string>>(new Map())
  const [failure, setFailure] = useState<DescribedError | null>(null)
  const loaded = useRef(false)

  const load = useCallback(async () => {
    if (!user || !enabled || loaded.current) return
    if (!navigator.onLine) return
    const { data, error } = await supabase
      .from('budgets')
      .select('id, category_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
    if (error) {
      setFailure(describeDataError(error, { action: 'load', entity: 'budget' }))
      return
    }
    const next = new Map<string, string>()
    for (const row of data as { id: string; category_id: string }[]) {
      if (!next.has(row.category_id)) next.set(row.category_id, row.id)
    }
    setBudgetByCategory(next)
    setFailure(null)
    loaded.current = true
  }, [user, enabled])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  const refetch = () => {
    loaded.current = false
    return load()
  }

  return { budgetByCategory, error: failure?.message ?? null, refetch }
}
