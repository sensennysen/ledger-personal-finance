import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { readCache, writeCache } from '@/lib/dataCache'
import { readAllPages } from '@/lib/pagedRead'
import type { SavingsGoal, Transaction } from '@/types'
import { describeDataError, toResult, type DescribedError, type MutationResult } from '@/lib/dataErrors'

export interface GoalWithContributions extends SavingsGoal {
  linkedTransactions?: Transaction[]
  totalContributed?: number
}

export function useSavingsGoals() {
  const { user } = useAuth()
  const [goals, setGoals] = useState<GoalWithContributions[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailure, setLoadFailure] = useState<DescribedError | null>(null)

  const fetch = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    const cacheKey = `${user.id}:savings_goals`
    const cached = readCache<GoalWithContributions[]>(cacheKey)
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
      setLoadFailure(describeDataError(error, { action: 'load' }))
      setLoading(false)
      return
    }

    // Fetch linked transactions for each goal
    const goalIds = (data as SavingsGoal[]).map((g) => g.id)
    let linkedTxs: Transaction[] = []
    if (goalIds.length > 0) {
      const { rows, error: txError } = await readAllPages<Transaction>((from, to) =>
        supabase
          .from('transactions')
          .select('*, category:categories(id,name,color,icon), account:accounts!transactions_account_id_fkey(id,name,color,currency)')
          .eq('user_id', user.id)
          .in('goal_id', goalIds)
          .order('date', { ascending: false })
          .order('id', { ascending: false })
          .range(from, to),
      )
      if (txError) {
        setLoadFailure(describeDataError(txError, { action: 'load' }))
        setLoading(false)
        return
      }
      linkedTxs = rows
    }

    const enriched: GoalWithContributions[] = (data as SavingsGoal[]).map((g) => {
      const txs = linkedTxs.filter((t) => t.goal_id === g.id)
      return {
        ...g,
        linkedTransactions: txs,
        totalContributed: txs.reduce((sum, t) => sum + (t.type === 'expense' ? -t.amount : t.amount), 0),
      }
    })

    setLoadFailure(null)
    setGoals(enriched)
    writeCache(cacheKey, enriched)
    setLoading(false)
  }, [user])

  useEffect(() => {
    queueMicrotask(() => {
      void fetch()
    })
  }, [fetch])

  const createGoal = async (
    values: Omit<SavingsGoal, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<MutationResult> => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) return { error: 'Connect to the internet to add a savings goal.' }
    const { error } = await supabase.from('savings_goals').insert({ ...values, user_id: user.id })
    if (!error) await fetch()
    return toResult(error, { action: 'save', entity: 'goal' })
  }

  const updateGoal = async (id: string, values: Partial<SavingsGoal>): Promise<MutationResult> => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) return { error: 'Connect to the internet to edit this savings goal.' }
    const { error } = await supabase.from('savings_goals').update(values).eq('id', id).eq('user_id', user.id)
    if (!error) await fetch()
    return toResult(error, { action: 'save', entity: 'goal' })
  }

  const deleteGoal = async (id: string): Promise<MutationResult> => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) return { error: 'Connect to the internet to remove this savings goal.' }
    const { error } = await supabase.from('savings_goals').delete().eq('id', id).eq('user_id', user.id)
    if (!error) await fetch()
    return toResult(error, { action: 'delete', entity: 'goal' })
  }

  const addContribution = async (id: string, amount: number, currentAmount: number) => {
    return updateGoal(id, { current_amount: currentAmount + amount })
  }

  const error = loadFailure?.message ?? null
  const errorDetail = loadFailure?.detail ?? null
  return { goals, loading, error, errorDetail, refetch: fetch, createGoal, updateGoal, deleteGoal, addContribution }
}
