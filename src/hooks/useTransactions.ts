import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { editQueuedInsert, enqueue, pendingCount as queueSize } from '@/lib/offlineQueue'
import { registerSyncListener } from '@/hooks/useNetworkStatus'
import { readCache, writeCache } from '@/lib/dataCache'
import { readAllPages } from '@/lib/pagedRead'
import { readWithPolicy } from '@/lib/readRetry'
import { dedupeAsync } from '@/lib/inFlightRequest'
import {
  notifyAccountsRefresh,
  notifyLoanPurchasesRefresh,
  notifyTransactionsRefresh,
  registerTransactionsListener,
} from '@/lib/cacheEvents'
import { buildSplitRpcLines, SPLIT_OFFLINE_MESSAGE, type SplitRpcLine } from '@/lib/splitState'
import { dueRecurringPosts, type RecurringRun } from '@/lib/recurringTransactions'
import { getLocalDateString } from '@/lib/utils'
import { generatedCardPayment } from '@/lib/cardPayment'
import { importedCardPayments, type SavedImportRow } from '@/lib/importTransfer'
import type { Transaction, Account, Category } from '@/types'
import {
  applyTxDelta,
  buildOptimisticTransaction,
  buildTransactionsCacheKey,
  forgetLegacyRecurringMap,
  limitTransactions,
  reverseTxDelta,
  txMatchesFilters,
  type TransactionFilters,
  type TransactionUpsertValues,
  withTransactionDefaults,
} from '@/hooks/useTransactions.helpers'
import { describeDataError, toResult, type DescribedError, type MutationResult } from '@/lib/dataErrors'

// ---------- hook ----------

export type { RecurringRun }

/** What a generated card payment hands back so the statement steps can run (LED-190). */
export type CardPaymentHandler = (payment: { card: Account; amount: number; date: string; transactionId: string }) => Promise<void>

export interface UseTransactionsOptions {
  /**
   * When false the hook reads nothing and returns an empty list — for callers
   * whose filter isn't known yet (Budgets before a budget is picked). A missing
   * filter still means "no filter", so a placeholder id is never needed.
   */
  enabled?: boolean
}

export function useTransactions(filters: TransactionFilters = {}, { enabled = true }: UseTransactionsOptions = {}) {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailure, setLoadFailure] = useState<DescribedError | null>(null)

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
    // Another mounted instance (Home beside the layout's add form) has its own copy of this list.
    notifyTransactionsRefresh()
  }, [buildCacheKey])

  const reloadFromCache = useCallback(() => {
    // Disabled, the key would be the unfiltered list's: never load it here.
    if (!user || !enabled) return
    const cached = readCache<Transaction[]>(buildCacheKey())
    if (cached) setTransactions(cached)
  }, [user, enabled, buildCacheKey])

  useEffect(() => registerTransactionsListener(reloadFromCache), [reloadFromCache])

  const fetch = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    if (!enabled) {
      setTransactions([])
      setLoadFailure(null)
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
    const buildQuery = () => {
      let query = supabase
        .from('transactions')
        .select(`
          *,
          account:accounts!transactions_account_id_fkey(id, name, color, currency),
          to_account:accounts!transactions_to_account_id_fkey(id, name, color, currency, type),
          category:categories(id, name, color, icon),
          subcategory:subcategories(id, name)
        `)
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })

      if (filters.accountId) query = query.or(`account_id.eq.${filters.accountId},to_account_id.eq.${filters.accountId}`)
      if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
      if (filters.type) query = query.eq('type', filters.type)
      if (filters.startDate) query = query.gte('date', filters.startDate)
      if (filters.endDate) query = query.lte('date', filters.endDate)
      return query
    }

    // An explicit limit is one request; otherwise page past PostgREST's 1,000-row cap. A first load
    // fails fast; with the cache on screen the library retries as before (LED-242).
    // Shared per cache key: AppLayout, the page, palette hooks and dashboard
    // cards mounting with the same filters in the same tick read the table once (LED-166).
    const { rows, error } = await dedupeAsync(cacheKey, () => readWithPolicy(async (retry) => {
      if (filters.limit) {
        const { data, error } = await buildQuery().limit(filters.limit).retry(retry)
        return { rows: (data ?? []) as Transaction[], error: error?.message ?? null }
      }
      return readAllPages<Transaction>((from, to) => buildQuery().range(from, to).retry(retry))
    }, { background: cached !== null }))
    if (error) {
      setLoadFailure(describeDataError(error, { action: 'load' }))
    } else {
      setLoadFailure(null)
      setTransactions(rows)
      writeCache(cacheKey, rows)
    }
    setLoading(false)
  }, [user, enabled, buildCacheKey, filters.accountId, filters.categoryId, filters.type, filters.startDate, filters.endDate, filters.limit])

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

  // `id` is chosen here, not by the database, so a queued create keeps one identity: a later edit of
  // it finds the queued insert (LED-193) and a card payment's statement can name the row it came from.
  const enqueueInsert = useCallback((values: TransactionUpsertValues, id?: string) => {
    if (!user) return

    enqueue({
      table: 'transactions',
      operation: 'insert',
      payload: { ...(id ? { id } : {}), ...withTransactionDefaults(values), user_id: user.id },
      userId: user.id,
    })
  }, [user])

  // ---------- mutations ----------

  const createTransaction = async (values: TransactionUpsertValues): Promise<MutationResult & { queued?: boolean; id?: string }> => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) {
      const now = new Date().toISOString()
      const queuedId = crypto.randomUUID()
      const cachedAccounts = readCache<Account[]>(`${user.id}:accounts`) ?? []
      const cachedCategories = readCache<Category[]>(`${user.id}:categories`) ?? []
      const optimistic: Transaction = {
        ...buildOptimisticTransaction({
          values,
          userId: user.id,
          now,
          id: queuedId,
          accounts: cachedAccounts,
          categories: cachedCategories,
        }),
        queued: true,
      }

      if (txMatchesFilters(optimistic, filters)) {
        updateTransactionCache(limitTransactions([optimistic, ...transactions], filters.limit))
      }

      optimisticAccountDelta((accounts) => applyTxDelta(accounts, values))
      enqueueInsert(values, queuedId)
      return { error: null, queued: true, id: queuedId }
    }
    const { data, error } = await supabase
      .from('transactions')
      .insert({ ...withTransactionDefaults(values), user_id: user.id })
      .select('id')
      .single()
    if (!error) {
      await fetch()
      notifyLoanPurchasesRefresh()
    }
    return { ...toResult(error, { action: 'save', entity: 'transaction' }), id: data?.id }
  }

  const updateTransaction = async (id: string, values: Partial<Transaction>): Promise<MutationResult & { queued?: boolean }> => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) {
      const existing = transactions.find((t) => t.id === id)
      if (existing) {
        const merged: Transaction = { ...existing, ...values, updated_at: new Date().toISOString(), queued: true }
        updateTransactionCache(transactions.map((t) => (t.id === id ? merged : t)))

        // Reverse old effect, apply new effect
        optimisticAccountDelta((accounts) =>
          applyTxDelta(reverseTxDelta(accounts, existing), merged)
        )
      }
      // A row that is still only a queued create is fixed in the queue; an update would target a
      // row the database has not seen (LED-193).
      if (!editQueuedInsert(id, values as Record<string, unknown>)) {
        enqueue({
          table: 'transactions',
          operation: 'update',
          payload: values as Record<string, unknown>,
          rowId: id,
          userId: user.id,
          // The edit may not touch description (e.g. a category-only change), so
          // the queue sheet title still has a name to show (LED-160).
          label: existing?.description,
        })
      }
      return { error: null, queued: true }
    }
    const { error } = await supabase.from('transactions').update(values).eq('id', id).eq('user_id', user.id)
    if (!error) {
      await fetch()
      notifyLoanPurchasesRefresh()
    }
    return toResult(error, { action: 'save', entity: 'transaction' })
  }

  // useCallback (stable across a scroll/window-growth render) so a memoised
  // TransactionRow's onDelete prop doesn't change identity every render.
  const deleteTransaction = useCallback(async (id: string): Promise<MutationResult & { queued?: boolean }> => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) {
      const existing = transactions.find((t) => t.id === id)
      if (existing) {
        updateTransactionCache(transactions.filter((t) => t.id !== id))
        optimisticAccountDelta((accounts) => reverseTxDelta(accounts, existing))
      }
      enqueue({
        table: 'transactions',
        operation: 'delete',
        payload: {},
        rowId: id,
        userId: user.id,
        // A delete's payload carries nothing to title the queue sheet with (LED-160).
        label: existing?.description,
      })
      return { error: null, queued: true }
    }
    const { error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', user.id)
    if (!error) {
      await fetch()
      notifyLoanPurchasesRefresh()
    }
    return toResult(error, { action: 'delete', entity: 'transaction' })
  }, [user, transactions, updateTransactionCache, optimisticAccountDelta, fetch])

  /** Splits one transaction into lines in a single database call: every line is written and the original removed, or nothing changes. */
  const splitTransaction = async (id: string, splits: SplitRpcLine[]): Promise<MutationResult> => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) return { error: SPLIT_OFFLINE_MESSAGE }
    const { error } = await supabase.rpc('split_transaction', { original_id: id, lines: buildSplitRpcLines(splits) })
    if (!error) {
      await fetch()
      notifyLoanPurchasesRefresh()
    }
    return toResult(error, { action: 'save', entity: 'transaction' })
  }

  const bulkDeleteTransactions = async (ids: string[]): Promise<MutationResult & { queued?: boolean }> => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) {
      const toDelete = transactions.filter((t) => ids.includes(t.id))
      updateTransactionCache(transactions.filter((t) => !ids.includes(t.id)))
      toDelete.forEach((tx) => {
        optimisticAccountDelta((accounts) => reverseTxDelta(accounts, tx))
        enqueue({ table: 'transactions', operation: 'delete', payload: {}, rowId: tx.id, userId: user.id, label: tx.description })
      })
      return { error: null, queued: true }
    }
    const { error } = await supabase
      .from('transactions')
      .delete()
      .in('id', ids)
      .eq('user_id', user.id)
    if (!error) {
      await fetch()
      notifyLoanPurchasesRefresh()
    }
    return toResult(error, { action: 'delete' })
  }

  const bulkUpdateCategory = async (ids: string[], categoryId: string | null): Promise<MutationResult & { queued?: boolean }> => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) {
      updateTransactionCache(transactions.map((t) =>
        ids.includes(t.id)
          ? { ...t, category_id: categoryId, updated_at: new Date().toISOString(), queued: true }
          : t
      ))
      ids.forEach((id) => {
        const existing = transactions.find((t) => t.id === id)
        enqueue({
          table: 'transactions',
          operation: 'update',
          payload: { category_id: categoryId },
          rowId: id,
          userId: user.id,
          // A category-only change doesn't touch description (LED-160).
          label: existing?.description,
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
    return toResult(error, { action: 'save' })
  }

  /**
   * Saves an import in one insert. `onCardPayment` runs for each saved transfer into a credit card,
   * oldest first and awaited, so the statement steps follow like a manual payment (LED-270). A queued
   * import gets them when it drains (`recordSynced`).
   */
  const bulkCreateTransactions = async (
    rows: TransactionUpsertValues[],
    onCardPayment?: CardPaymentHandler,
  ): Promise<MutationResult & { imported: number }> => {
    if (!user) return { error: 'Not authenticated', imported: 0 }
    if (!navigator.onLine) {
      const now = new Date().toISOString()
      const optimistics = rows.map((values) => ({
        ...buildOptimisticTransaction({ values, userId: user.id, now, id: crypto.randomUUID() }),
        queued: true,
      }))
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
    const { data: saved, error } = await supabase
      .from('transactions')
      .insert(rows.map((row) => ({ ...withTransactionDefaults(row), user_id: user.id })))
      .select('id, type, to_account_id, amount, exchange_rate, destination_amount, date')
    if (!error) await fetch()
    if (!error && onCardPayment && saved) {
      const savedRows = saved as SavedImportRow[]
      const cardIds = [...new Set(savedRows.filter((row) => row.type === 'transfer' && row.to_account_id).map((row) => row.to_account_id!))]
      if (cardIds.length) {
        // The destinations as they are now, like generateDueRecurring: the statement steps read the card.
        const { data: destinations } = await supabase.from('accounts').select('*').in('id', cardIds)
        for (const payment of importedCardPayments(savedRows, (destinations ?? []) as Account[])) await onCardPayment(payment)
      }
    }
    return { ...toResult(error, { action: 'save' }), imported: error ? 0 : rows.length }
  }

  /**
   * Posts every recurring row that has come due. The database decides whether a row's next
   * occurrence is already posted (LED-232), so another browser or device never posts it twice.
   * `onCardPayment` runs for a generated transfer
   * into a credit card, with the card as it is now, so the statement steps follow (LED-190).
   * It is awaited, so two payments to one card never read the same statement.
   */
  const generateDueRecurring = useCallback(async (onCardPayment?: CardPaymentHandler): Promise<RecurringRun> => {
    if (!user || !navigator.onLine) return { posted: 0, failed: 0 }
    forgetLegacyRecurringMap()
    const today = getLocalDateString()
    const { rows: allRecurring, error: recurringError } = await readAllPages<Transaction>((from, to) =>
      supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_recurring', true)
        .eq('recurrence_next_posted', false)
        .order('date', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to),
    )
    // A failed read means nothing is known to be due, and a partial list would skip series.
    // Say so: the caller reports it rather than treating it as "nothing due".
    if (recurringError) return { posted: 0, failed: 0, readFailed: true }

    let posted = 0
    let failed = 0
    for (const { source: tx, date: nextDate } of dueRecurringPosts(allRecurring, today)) {
      const { data: insertedId, error } = await supabase.rpc('post_recurring_transaction', {
        p_source: tx.id,
        p_date: nextDate,
      })
      if (error) {
        failed++
        continue
      }
      // null: already posted, by this or another device.
      if (typeof insertedId !== 'string') continue
      posted++
      if (onCardPayment && tx.type === 'transfer' && tx.to_account_id) {
        const { data: destination } = await supabase.from('accounts').select('*').eq('id', tx.to_account_id).maybeSingle()
        const payment = destination ? generatedCardPayment(tx, [destination as Account]) : null
        if (payment) await onCardPayment({ ...payment, date: nextDate, transactionId: insertedId })
      }
    }
    if (posted > 0) await fetch()
    return { posted, failed }
  }, [user, fetch])

  const error = loadFailure?.message ?? null
  const errorDetail = loadFailure?.detail ?? null
  return {
    transactions,
    loading,
    error,
    errorDetail,
    refetch: fetch,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    splitTransaction,
    bulkDeleteTransactions,
    bulkUpdateCategory,
    bulkCreateTransactions,
    generateDueRecurring,
    pendingSync: queueSize(),
  }
}
