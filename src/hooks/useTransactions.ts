import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Transaction } from '@/types'

interface TransactionFilters {
  accountId?: string
  categoryId?: string
  type?: string
  startDate?: string
  endDate?: string
  limit?: number
}

export function useTransactions(filters: TransactionFilters = {}) {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    let query = supabase
      .from('transactions')
      .select(`
        *,
        account:accounts!transactions_account_id_fkey(id, name, color, currency),
        to_account:accounts!transactions_to_account_id_fkey(id, name, color, currency),
        category:categories(id, name, color, icon)
      `)
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (filters.accountId) query = query.eq('account_id', filters.accountId)
    if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
    if (filters.type) query = query.eq('type', filters.type)
    if (filters.startDate) query = query.gte('date', filters.startDate)
    if (filters.endDate) query = query.lte('date', filters.endDate)
    if (filters.limit) query = query.limit(filters.limit)

    const { data, error } = await query
    if (error) setError(error.message)
    else setTransactions(data as Transaction[])
    setLoading(false)
  }, [user, filters.accountId, filters.categoryId, filters.type, filters.startDate, filters.endDate, filters.limit])

  useEffect(() => { fetch() }, [fetch])

  const createTransaction = async (
    values: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'account' | 'to_account' | 'category'>
  ) => {
    if (!user) return { error: 'Not authenticated' }
    const { error } = await supabase.from('transactions').insert({ ...values, user_id: user.id })
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  const updateTransaction = async (id: string, values: Partial<Transaction>) => {
    if (!user) return { error: 'Not authenticated' }
    const { error } = await supabase.from('transactions').update(values).eq('id', id).eq('user_id', user.id)
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  const deleteTransaction = async (id: string) => {
    if (!user) return { error: 'Not authenticated' }
    const { error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', user.id)
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  return {
    transactions,
    loading,
    error,
    refetch: fetch,
    createTransaction,
    updateTransaction,
    deleteTransaction,
  }
}
