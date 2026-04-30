import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { enqueue, pendingCount as queueSize } from '@/lib/offlineQueue'
import { registerSyncListener } from '@/hooks/useNetworkStatus'
import { readCache, writeCache } from '@/lib/dataCache'
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
    const cacheKey = `${user.id}:transactions:${JSON.stringify({
      accountId: filters.accountId,
      categoryId: filters.categoryId,
      type: filters.type,
      startDate: filters.startDate,
      endDate: filters.endDate,
      limit: filters.limit,
    })}`
    const cached = readCache<Transaction[]>(cacheKey)
    if (cached) {
      setTransactions(cached)
      setLoading(false)
    } else {
      setLoading(true)
    }
    if (!navigator.onLine) return
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
    if (error) {
      setError(error.message)
    } else {
      setTransactions(data as Transaction[])
      writeCache(cacheKey, data)
    }
    setLoading(false)
  }, [user, filters.accountId, filters.categoryId, filters.type, filters.startDate, filters.endDate, filters.limit])

  useEffect(() => { fetch() }, [fetch])

  // Refetch when the offline queue is drained (connection restored)
  useEffect(() => {
    const unregister = registerSyncListener(fetch)
    return () => { unregister() }
  }, [fetch])

  const createTransaction = async (
    values: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'account' | 'to_account' | 'category'>
  ) => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) {
      enqueue({ table: 'transactions', operation: 'insert', payload: { ...values, user_id: user.id }, userId: user.id })
      return { error: null, queued: true }
    }
    const { error } = await supabase.from('transactions').insert({ ...values, user_id: user.id })
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  const updateTransaction = async (id: string, values: Partial<Transaction>) => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) {
      enqueue({ table: 'transactions', operation: 'update', payload: values as Record<string, unknown>, rowId: id, userId: user.id })
      return { error: null, queued: true }
    }
    const { error } = await supabase.from('transactions').update(values).eq('id', id).eq('user_id', user.id)
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  const deleteTransaction = async (id: string) => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) {
      enqueue({ table: 'transactions', operation: 'delete', payload: {}, rowId: id, userId: user.id })
      return { error: null, queued: true }
    }
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
    pendingSync: queueSize(),
  }
}
