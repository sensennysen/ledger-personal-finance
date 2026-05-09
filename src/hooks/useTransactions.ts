import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { enqueue, pendingCount as queueSize } from '@/lib/offlineQueue'
import { registerSyncListener } from '@/hooks/useNetworkStatus'
import { readCache, writeCache } from '@/lib/dataCache'
import { notifyAccountsRefresh } from '@/lib/cacheEvents'
import { addRecurringIntervalToDateString } from '@/lib/recurringTransactions'
import type { Transaction, Account, Category } from '@/types'
import {
  applyTxDelta,
  buildOptimisticTransaction,
  buildTransactionsCacheKey,
  limitTransactions,
  markRecurringGenerated,
  reverseTxDelta,
  txMatchesFilters,
  type TransactionFilters,
  type TransactionUpsertValues,
  wasRecurringGenerated,
  withTransactionDefaults,
} from '@/hooks/useTransactions.helpers'

// ---------- hook ----------

export function useTransactions(filters: TransactionFilters = {}) {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const buildCacheKey = useCallback(
    () =>
      buildTransactionsCacheKey(user!.id, {
        accountId: filters.accountId,
        categoryId: filters.categoryId,
        type: filters.type,
        startDate: filters.startDate,
        endDate: filters.endDate,
        limit: filters.limit,
      }),
    [user, filters.accountId, filters.categoryId, filters.type, filters.startDate, filters.endDate, filters.limit]
  )

  const updateTransactionCache = useCallback((next: Transaction[]) => {
    setTransactions(next)
    writeCache(buildCacheKey(), next)
  }, [buildCacheKey])

  const fetch = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    const cacheKey = buildCacheKey()
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
        category:categories(id, name, color, icon),
        subcategory:subcategories(id, name)
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
  }, [user, buildCacheKey, filters.accountId, filters.categoryId, filters.type, filters.startDate, filters.endDate, filters.limit])

  useEffect(() => {
    queueMicrotask(() => {
      void fetch()
    })
  }, [fetch])

  // Refetch when the offline queue is drained (connection restored)
  useEffect(() => {
    const unregister = registerSyncListener(fetch)
    return () => { unregister() }
  }, [fetch])

  // ---------- helpers for optimistic account updates ----------

  const optimisticAccountDelta = useCallback((applyFn: (accounts: Account[]) => Account[]) => {
    if (!user) return
    const accountCacheKey = `${user.id}:accounts`
    const cached = readCache<Account[]>(accountCacheKey)
    if (!cached) return
    const updated = applyFn(cached)
    writeCache(accountCacheKey, updated)
    notifyAccountsRefresh()
  }, [user])

  const enqueueInsert = useCallback((values: TransactionUpsertValues) => {
    if (!user) return

    enqueue({
      table: 'transactions',
      operation: 'insert',
      payload: { ...withTransactionDefaults(values), user_id: user.id },
      userId: user.id,
    })
  }, [user])

  // ---------- mutations ----------

  const createTransaction = async (values: TransactionUpsertValues) => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) {
      const now = new Date().toISOString()
      const cachedAccounts = readCache<Account[]>(`${user.id}:accounts`) ?? []
      const cachedCategories = readCache<Category[]>(`${user.id}:categories`) ?? []
      const optimistic = buildOptimisticTransaction({
        values,
        userId: user.id,
        now,
        id: crypto.randomUUID(),
        accounts: cachedAccounts,
        categories: cachedCategories,
      })

      if (txMatchesFilters(optimistic, filters)) {
        updateTransactionCache(limitTransactions([optimistic, ...transactions], filters.limit))
      }

      optimisticAccountDelta((accounts) => applyTxDelta(accounts, values))
      enqueueInsert(values)
      return { error: null, queued: true }
    }
    const { error } = await supabase.from('transactions').insert({ ...withTransactionDefaults(values), user_id: user.id })
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  const updateTransaction = async (id: string, values: Partial<Transaction>) => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) {
      const existing = transactions.find((t) => t.id === id)
      if (existing) {
        const merged: Transaction = { ...existing, ...values, updated_at: new Date().toISOString() }
        updateTransactionCache(transactions.map((t) => (t.id === id ? merged : t)))

        // Reverse old effect, apply new effect
        optimisticAccountDelta((accounts) =>
          applyTxDelta(reverseTxDelta(accounts, existing), merged)
        )
      }
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
      const existing = transactions.find((t) => t.id === id)
      if (existing) {
        updateTransactionCache(transactions.filter((t) => t.id !== id))
        optimisticAccountDelta((accounts) => reverseTxDelta(accounts, existing))
      }
      enqueue({ table: 'transactions', operation: 'delete', payload: {}, rowId: id, userId: user.id })
      return { error: null, queued: true }
    }
    const { error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', user.id)
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  const bulkDeleteTransactions = async (ids: string[]) => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) {
      const toDelete = transactions.filter((t) => ids.includes(t.id))
      updateTransactionCache(transactions.filter((t) => !ids.includes(t.id)))
      toDelete.forEach((tx) => {
        optimisticAccountDelta((accounts) => reverseTxDelta(accounts, tx))
        enqueue({ table: 'transactions', operation: 'delete', payload: {}, rowId: tx.id, userId: user.id })
      })
      return { error: null, queued: true }
    }
    const { error } = await supabase
      .from('transactions')
      .delete()
      .in('id', ids)
      .eq('user_id', user.id)
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  const bulkUpdateCategory = async (ids: string[], categoryId: string | null) => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) {
      updateTransactionCache(transactions.map((t) =>
        ids.includes(t.id)
          ? { ...t, category_id: categoryId, updated_at: new Date().toISOString() }
          : t
      ))
      ids.forEach((id) => {
        enqueue({
          table: 'transactions',
          operation: 'update',
          payload: { category_id: categoryId },
          rowId: id,
          userId: user.id,
        })
      })
      return { error: null, queued: true }
    }
    const { error } = await supabase
      .from('transactions')
      .update({ category_id: categoryId })
      .in('id', ids)
      .eq('user_id', user.id)
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  const bulkCreateTransactions = async (rows: TransactionUpsertValues[]) => {
    if (!user) return { error: 'Not authenticated', imported: 0 }
    if (!navigator.onLine) {
      const now = new Date().toISOString()
      const optimistics = rows.map((values) =>
        buildOptimisticTransaction({ values, userId: user.id, now, id: crypto.randomUUID() })
      )
      const filtered = optimistics.filter((tx) => txMatchesFilters(tx, filters))
      if (filtered.length) {
        updateTransactionCache(limitTransactions([...filtered, ...transactions], filters.limit))
      }
      rows.forEach((values) => {
        optimisticAccountDelta((accounts) => applyTxDelta(accounts, values))
        enqueueInsert(values)
      })
      return { error: null, imported: rows.length }
    }
    const { error } = await supabase
      .from('transactions')
      .insert(rows.map((row) => ({ ...withTransactionDefaults(row), user_id: user.id })))
    if (!error) await fetch()
    return { error: error?.message ?? null, imported: error ? 0 : rows.length }
  }

  const generateDueRecurring = useCallback(async (): Promise<number> => {
    if (!user || !navigator.onLine) return 0
    const today = new Date().toISOString().split('T')[0]
    const { data: allRecurring } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_recurring', true)
      .order('date', { ascending: false })
    if (!allRecurring?.length) return 0

    let generated = 0
    for (const tx of allRecurring as Transaction[]) {
      if (!tx.recurrence_interval) continue
      const nextDate = addRecurringIntervalToDateString(tx.date, tx.recurrence_interval)
      if (nextDate > today) continue
      if (tx.recurrence_end_date && nextDate > tx.recurrence_end_date) continue
      if (wasRecurringGenerated(tx.id, nextDate)) continue

      const { error } = await supabase.from('transactions').insert({
        user_id: user.id,
        account_id: tx.account_id,
        to_account_id: tx.to_account_id,
        category_id: tx.category_id,
        subcategory_id: tx.subcategory_id,
        type: tx.type,
        amount: tx.amount,
        currency: tx.currency,
        exchange_rate: tx.exchange_rate,
        description: tx.description,
        notes: tx.notes,
        date: nextDate,
        transfer_fee: tx.transfer_fee,
        is_recurring: true,
        recurrence_interval: tx.recurrence_interval,
        recurrence_end_date: tx.recurrence_end_date,
        receipt_url: null,
        tags: tx.tags ?? [],
        goal_id: tx.goal_id ?? null,
      })
      if (!error) {
        markRecurringGenerated(tx.id, nextDate)
        generated++
      }
    }
    if (generated > 0) await fetch()
    return generated
  }, [user, fetch])

  return {
    transactions,
    loading,
    error,
    refetch: fetch,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    bulkDeleteTransactions,
    bulkUpdateCategory,
    bulkCreateTransactions,
    generateDueRecurring,
    pendingSync: queueSize(),
  }
}
