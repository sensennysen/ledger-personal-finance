import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { enqueue, pendingCount as queueSize } from '@/lib/offlineQueue'
import { registerSyncListener } from '@/hooks/useNetworkStatus'
import { readCache, writeCache } from '@/lib/dataCache'
import { notifyAccountsRefresh } from '@/lib/cacheEvents'
import type { Transaction, Account, Category } from '@/types'

interface TransactionFilters {
  accountId?: string
  categoryId?: string
  type?: string
  startDate?: string
  endDate?: string
  limit?: number
}

// ---------- balance helpers ----------

type TxShape = Pick<Transaction, 'account_id' | 'to_account_id' | 'type' | 'amount' | 'transfer_fee'>

function applyTxDelta(accounts: Account[], tx: TxShape): Account[] {
  return accounts.map((a) => {
    if (a.id === tx.account_id) {
      const delta =
        tx.type === 'income' ? tx.amount
        : tx.type === 'expense' ? -tx.amount
        : -(tx.amount + (tx.transfer_fee ?? 0))
      return { ...a, balance: a.balance + delta }
    }
    if (tx.type === 'transfer' && a.id === tx.to_account_id) {
      return { ...a, balance: a.balance + tx.amount }
    }
    return a
  })
}

function reverseTxDelta(accounts: Account[], tx: TxShape): Account[] {
  return accounts.map((a) => {
    if (a.id === tx.account_id) {
      const delta =
        tx.type === 'income' ? -tx.amount
        : tx.type === 'expense' ? tx.amount
        : tx.amount + (tx.transfer_fee ?? 0)
      return { ...a, balance: a.balance + delta }
    }
    if (tx.type === 'transfer' && a.id === tx.to_account_id) {
      return { ...a, balance: a.balance - tx.amount }
    }
    return a
  })
}

function txMatchesFilters(tx: Transaction, filters: TransactionFilters): boolean {
  if (filters.accountId && tx.account_id !== filters.accountId) return false
  if (filters.categoryId && tx.category_id !== filters.categoryId) return false
  if (filters.type && tx.type !== filters.type) return false
  if (filters.startDate && tx.date < filters.startDate) return false
  if (filters.endDate && tx.date > filters.endDate) return false
  return true
}

// ---------- hook ----------

export function useTransactions(filters: TransactionFilters = {}) {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const buildCacheKey = useCallback(() =>
    `${user!.id}:transactions:${JSON.stringify({
      accountId: filters.accountId,
      categoryId: filters.categoryId,
      type: filters.type,
      startDate: filters.startDate,
      endDate: filters.endDate,
      limit: filters.limit,
    })}`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, filters.accountId, filters.categoryId, filters.type, filters.startDate, filters.endDate, filters.limit]
  )

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

  useEffect(() => { fetch() }, [fetch])

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

  // ---------- mutations ----------

  const createTransaction = async (
    values: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'account' | 'to_account' | 'category' | 'subcategory'>
  ) => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) {
      const now = new Date().toISOString()
      const tempId = crypto.randomUUID()
      const cachedAccounts = readCache<Account[]>(`${user.id}:accounts`) ?? []
      const cachedCategories = readCache<Category[]>(`${user.id}:categories`) ?? []

      const optimistic: Transaction = {
        ...values,
        id: tempId,
        user_id: user.id,
        created_at: now,
        updated_at: now,
        account: cachedAccounts.find((a) => a.id === values.account_id),
        to_account: cachedAccounts.find((a) => a.id === values.to_account_id) ?? undefined,
        category: cachedCategories.find((c) => c.id === values.category_id) ?? undefined,
      }

      if (txMatchesFilters(optimistic, filters)) {
        const next = [optimistic, ...transactions]
        const limited = filters.limit ? next.slice(0, filters.limit) : next
        setTransactions(limited)
        writeCache(buildCacheKey(), limited)
      }

      optimisticAccountDelta((accounts) => applyTxDelta(accounts, values))
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
      const existing = transactions.find((t) => t.id === id)
      if (existing) {
        const merged: Transaction = { ...existing, ...values, updated_at: new Date().toISOString() }
        const next = transactions.map((t) => (t.id === id ? merged : t))
        setTransactions(next)
        writeCache(buildCacheKey(), next)

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
        const next = transactions.filter((t) => t.id !== id)
        setTransactions(next)
        writeCache(buildCacheKey(), next)
        optimisticAccountDelta((accounts) => reverseTxDelta(accounts, existing))
      }
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
