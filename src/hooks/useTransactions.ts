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

type TxShape = Pick<
  Transaction,
  'account_id' | 'to_account_id' | 'type' | 'amount' | 'exchange_rate' | 'transfer_fee'
>

function applyTxDelta(accounts: Account[], tx: TxShape): Account[] {
  return accounts.map((a) => {
    if (a.id === tx.account_id) {
      const delta =
        tx.type === 'income'
          ? tx.amount
          : tx.type === 'expense'
            ? -tx.amount
            : -(tx.amount + (tx.transfer_fee ?? 0))
      return { ...a, balance: a.balance + delta }
    }
    if (tx.type === 'transfer' && a.id === tx.to_account_id) {
      return { ...a, balance: a.balance + tx.amount * (tx.exchange_rate ?? 1) }
    }
    return a
  })
}

function reverseTxDelta(accounts: Account[], tx: TxShape): Account[] {
  return accounts.map((a) => {
    if (a.id === tx.account_id) {
      const delta =
        tx.type === 'income'
          ? -tx.amount
          : tx.type === 'expense'
            ? tx.amount
            : tx.amount + (tx.transfer_fee ?? 0)
      return { ...a, balance: a.balance + delta }
    }
    if (tx.type === 'transfer' && a.id === tx.to_account_id) {
      return { ...a, balance: a.balance - tx.amount * (tx.exchange_rate ?? 1) }
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
        tags: [],
        goal_id: null,
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
      enqueue({ table: 'transactions', operation: 'insert', payload: { tags: [], goal_id: null, ...values, user_id: user.id }, userId: user.id })
      return { error: null, queued: true }
    }
    const { error } = await supabase.from('transactions').insert({ tags: [], goal_id: null, ...values, user_id: user.id })
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

  const bulkDeleteTransactions = async (ids: string[]) => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) {
      const toDelete = transactions.filter((t) => ids.includes(t.id))
      const next = transactions.filter((t) => !ids.includes(t.id))
      setTransactions(next)
      writeCache(buildCacheKey(), next)
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
      const next = transactions.map((t) =>
        ids.includes(t.id)
          ? { ...t, category_id: categoryId, updated_at: new Date().toISOString() }
          : t
      )
      setTransactions(next)
      writeCache(buildCacheKey(), next)
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

  const bulkCreateTransactions = async (
    rows: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'account' | 'to_account' | 'category' | 'subcategory'>[]
  ) => {
    if (!user) return { error: 'Not authenticated', imported: 0 }
    if (!navigator.onLine) {
      const now = new Date().toISOString()
      const optimistics: Transaction[] = rows.map((values) => ({
        tags: [],
        goal_id: null,
        ...values,
        id: crypto.randomUUID(),
        user_id: user.id,
        created_at: now,
        updated_at: now,
      }))
      const filtered = optimistics.filter((tx) => txMatchesFilters(tx, filters))
      if (filtered.length) {
        const next = [...filtered, ...transactions]
        const limited = filters.limit ? next.slice(0, filters.limit) : next
        setTransactions(limited)
        writeCache(buildCacheKey(), limited)
      }
      rows.forEach((values) => {
        optimisticAccountDelta((accounts) => applyTxDelta(accounts, values))
        enqueue({ table: 'transactions', operation: 'insert', payload: { tags: [], goal_id: null, ...values, user_id: user.id }, userId: user.id })
      })
      return { error: null, imported: rows.length }
    }
    const { error } = await supabase
      .from('transactions')
      .insert(rows.map((r) => ({ tags: [], goal_id: null, ...r, user_id: user.id })))
    if (!error) await fetch()
    return { error: error?.message ?? null, imported: error ? 0 : rows.length }
  }

  // ---------- generateDueRecurring ----------

  const RECURRING_KEY = 'ledger-recurring-generated'

  function getGeneratedMap(): Record<string, true> {
    try { return JSON.parse(localStorage.getItem(RECURRING_KEY) ?? '{}') } catch { return {} }
  }
  function markGenerated(txId: string, date: string) {
    const map = getGeneratedMap()
    map[`${txId}__${date}`] = true
    try { localStorage.setItem(RECURRING_KEY, JSON.stringify(map)) } catch {}
  }
  function wasGenerated(txId: string, date: string): boolean {
    return getGeneratedMap()[`${txId}__${date}`] === true
  }

  function addInterval(dateStr: string, interval: string): string {
    const [y, m, d] = dateStr.split('-').map(Number)
    let next: Date
    switch (interval) {
      case 'daily':     next = new Date(y, m - 1, d + 1); break
      case 'weekly':    next = new Date(y, m - 1, d + 7); break
      case 'biweekly':  next = new Date(y, m - 1, d + 14); break
      case 'quarterly': next = new Date(y, m + 2, d); break
      case 'yearly':    next = new Date(y + 1, m - 1, d); break
      case 'monthly':
      default:          next = new Date(y, m, d); break
    }
    const ny = next.getFullYear()
    const nm = String(next.getMonth() + 1).padStart(2, '0')
    const nd = String(next.getDate()).padStart(2, '0')
    return `${ny}-${nm}-${nd}`
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
      const nextDate = addInterval(tx.date, tx.recurrence_interval)
      if (nextDate > today) continue
      if (tx.recurrence_end_date && nextDate > tx.recurrence_end_date) continue
      if (wasGenerated(tx.id, nextDate)) continue

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
        markGenerated(tx.id, nextDate)
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
