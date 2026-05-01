import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { readCache, writeCache } from '@/lib/dataCache'
import type { SavingsGoal } from '@/types'

export function useSavingsGoals() {
  const { user } = useAuth()
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    const cacheKey = `${user.id}:savings_goals`
    const cached = readCache<SavingsGoal[]>(cacheKey)
    if (cached) {
      setGoals(cached)
      setLoading(false)
    } else {
      setLoading(true)
    }
    if (!navigator.onLine) return

    const { data, error } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setGoals(data as SavingsGoal[])
    writeCache(cacheKey, data)
    setLoading(false)
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  const createGoal = async (
    values: Omit<SavingsGoal, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ) => {
    if (!user) return { error: 'Not authenticated' }
    const { error } = await supabase.from('savings_goals').insert({ ...values, user_id: user.id })
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  const updateGoal = async (id: string, values: Partial<SavingsGoal>) => {
    if (!user) return { error: 'Not authenticated' }
    const { error } = await supabase.from('savings_goals').update(values).eq('id', id).eq('user_id', user.id)
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  const deleteGoal = async (id: string) => {
    if (!user) return { error: 'Not authenticated' }
    const { error } = await supabase.from('savings_goals').delete().eq('id', id).eq('user_id', user.id)
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  const addContribution = async (id: string, amount: number, currentAmount: number) => {
    return updateGoal(id, { current_amount: currentAmount + amount })
  }

  return { goals, loading, error, refetch: fetch, createGoal, updateGoal, deleteGoal, addContribution }
}
