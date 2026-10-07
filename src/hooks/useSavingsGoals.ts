import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useEntityQuery } from '@/hooks/useEntityQuery'
import { readAllPages } from '@/lib/pagedRead'
import { readInBatches } from '@/lib/idBatches'
import type { SavingsGoal, Transaction } from '@/types'
import { toResult, type MutationResult } from '@/lib/dataErrors'

export interface GoalWithContributions extends SavingsGoal {
  linkedTransactions?: Transaction[]
}

const NO_GOALS: GoalWithContributions[] = []

export function useSavingsGoals() {
  const { user } = useAuth()

  // Shared by every instance (LED-321): a goal and its linked transactions are one read.
  const { data, loading, error, errorDetail, refetch: fetch } = useEntityQuery<GoalWithContributions[]>({
    entity: 'savings-goals',
    offlineLabel: 'your savings goals',
    cacheKey: (userId) => `${userId}:savings_goals`,
    read: async (userId, retry, signal) => {
      const { data, error } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .abortSignal(signal)
        .retry(retry)
      if (error) return { data: null, error }

      // Fetch linked transactions for each goal
      const goalIds = (data as SavingsGoal[]).map((g) => g.id)
      let linkedTxs: Transaction[] = []
      if (goalIds.length > 0) {
        // Batched so the goal id filter stays short enough for a URL (LED-308).
        const { rows, error: txError } = await readInBatches(goalIds, (batch) => readAllPages<Transaction>((from, to) =>
          supabase
            .from('transactions')
            .select('*, category:categories(id,name,color,icon), account:accounts!transactions_account_id_fkey(id,name,color,currency)')
            .eq('user_id', userId)
            .in('goal_id', batch)
            .order('date', { ascending: false })
            .order('id', { ascending: false })
            .range(from, to)
            .abortSignal(signal)
            .retry(retry),
        ))
        if (txError) return { data: null, error: txError }
        linkedTxs = rows
      }

      const enriched: GoalWithContributions[] = (data as SavingsGoal[]).map((g) => {
        const txs = linkedTxs.filter((t) => t.goal_id === g.id)
        // The total is converted to the goal's currency where it is shown, with the rates (LED-311).
        return { ...g, linkedTransactions: txs }
      })
      return { data: enriched, error: null }
    },
  })
  const goals = data ?? NO_GOALS

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

  /**
   * Adds to a goal in one database call that locks the goal and increments in SQL, so concurrent
   * contributions all count (LED-312). `opId` is one per contribution: a retry with the same id after
   * a lost response is counted once.
   */
  const addContribution = async (id: string, amount: number, opId: string): Promise<MutationResult> => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) return { error: 'Connect to the internet to add to this savings goal.' }
    const { error } = await supabase.rpc('add_goal_contribution', { p_goal_id: id, p_amount: amount, p_op_id: opId })
    if (!error) await fetch()
    return toResult(error, { action: 'save', entity: 'goal' })
  }

  return { goals, loading, error, errorDetail, refetch: fetch, createGoal, updateGoal, deleteGoal, addContribution }
}
