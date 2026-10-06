import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { drainQueue, editQueuedInsert, enqueue, enqueueMany, pendingCount as queueSize, revisionFor } from '@/lib/offlineQueue'
import { splitPendingReceipt } from '@/lib/receiptJob'
import { notifySyncListeners, registerSyncListener } from '@/hooks/useNetworkStatus'
import { readCache, writeCache } from '@/lib/dataCache'
import { readAllPages } from '@/lib/pagedRead'
import { readWithPolicy } from '@/lib/readRetry'
import { dedupeAsync } from '@/lib/inFlightRequest'
import {
  notifyAccountsRefresh,
  notifyCardPaymentsRefresh,
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
    // Another mounted instance (Home beside the layout's add form) has its own copy of this list.
    // It reloads from the cache, so when the copy could not be written, asking it to would reload
    // the old list over this one too (LED-303).
    if (writeCache(buildCacheKey(), next)) notifyTransactionsRefresh()
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
  const insertItem = useCallback((values: TransactionUpsertValues, userId: string, id?: string) => ({
    table: 'transactions',
    operation: 'insert' as const,
    payload: { ...(id ? { id } : {}), ...withTransactionDefaults(values), user_id: userId },
    userId,
  }), [])

  // A receipt whose upload failed while saving online follows the row as a queued edit, made
  // against the revision just saved, and uploads when it can (LED-300).
  const queueReceipt = useCallback(async (row: { id: string; updated_at: string }, marker: string, label?: string) => {
    if (!user) return
    const { error } = await enqueue({
      table: 'transactions',
      operation: 'update',
      payload: { receipt_url: marker },
      rowId: row.id,
      baseRevision: row.updated_at,
      userId: user.id,
      label,
    })
    if (error) {
      // The row is saved; only its receipt could not be kept for a later upload.
      console.error('The transaction was saved without its receipt:', error)
      return
    }
    void drainQueue().then(() => notifySyncListeners(), () => {})
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

      // Stored first: nothing is shown as saved until the queue holds it (LED-303).
      const { error } = await enqueue(insertItem(values, user.id, queuedId))
      if (error) return { error }

      if (txMatchesFilters(optimistic, filters)) {
        updateTransactionCache(limitTransactions([optimistic, ...transactions], filters.limit))
      }

      optimisticAccountDelta((accounts) => applyTxDelta(accounts, values))
      return { error: null, queued: true, id: queuedId }
    }
    const { values: saved, marker } = splitPendingReceipt(values)
    const { data, error } = await supabase
      .from('transactions')
      .insert({ ...withTransactionDefaults(saved), user_id: user.id })
      .select('id, updated_at')
      .single()
    if (!error && data && marker) await queueReceipt(data, marker, values.description)
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
      // A row that is still only a queued create is fixed in the queue; an update would target a
      // row the database has not seen (LED-193). Stored before it is shown (LED-303).
      const queuedEdit = await editQueuedInsert(id, values as Record<string, unknown>)
      if (queuedEdit.error) return { error: queuedEdit.error }
      if (!queuedEdit.edited) {
        const { error } = await enqueue({
          table: 'transactions',
          operation: 'update',
          payload: values as Record<string, unknown>,
          rowId: id,
          baseRevision: revisionFor('transactions', existing),
          userId: user.id,
          // The edit may not touch description (e.g. a category-only change), so
          // the queue sheet title still has a name to show (LED-160).
          label: existing?.description,
        })
        if (error) return { error }
      }
      if (existing) {
        // updated_at stays the server's: it is the revision the queued change is made against (LED-297).
        const merged: Transaction = { ...existing, ...values, queued: true }
        updateTransactionCache(transactions.map((t) => (t.id === id ? merged : t)))

        // Reverse old effect, apply new effect
        optimisticAccountDelta((accounts) =>
          applyTxDelta(reverseTxDelta(accounts, existing), merged)
        )
      }
      return { error: null, queued: true }
    }
    const { values: saved, marker } = splitPendingReceipt(values)
    const { data, error } = await supabase
      .from('transactions')
      .update(saved)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, updated_at')
      .maybeSingle()
    if (!error && data && marker) await queueReceipt(data, marker, values.description ?? transactions.find((t) => t.id === id)?.description)
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
      const { error } = await enqueue({
        table: 'transactions',
        operation: 'delete',
        payload: {},
        rowId: id,
        baseRevision: revisionFor('transactions', existing),
        userId: user.id,
        // A delete's payload carries nothing to title the queue sheet with (LED-160).
        label: existing?.description,
      })
      if (error) return { error }
      if (existing) {
        updateTransactionCache(transactions.filter((t) => t.id !== id))
        optimisticAccountDelta((accounts) => reverseTxDelta(accounts, existing))
      }
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
      // One write for the selection: all of it is stored, or none of it is shown (LED-303).
      const { error } = await enqueueMany(toDelete.map((tx) => (
        { table: 'transactions', operation: 'delete' as const, payload: {}, rowId: tx.id, baseRevision: revisionFor('transactions', tx), userId: user.id, label: tx.description }
      )))
      if (error) return { error }
      updateTransactionCache(transactions.filter((t) => !ids.includes(t.id)))
      toDelete.forEach((tx) => {
        optimisticAccountDelta((accounts) => reverseTxDelta(accounts, tx))
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
      const { error } = await enqueueMany(ids.map((id) => {
        const existing = transactions.find((t) => t.id === id)
        return {
          table: 'transactions',
          operation: 'update' as const,
          // A subcategory belongs to one category, so a new category clears it (LED-315).
          payload: { category_id: categoryId, subcategory_id: null },
          rowId: id,
          baseRevision: revisionFor('transactions', existing),
          userId: user.id,
          // A category-only change doesn't touch description (LED-160).
          label: existing?.description,
        }
      }))
      if (error) return { error }
      updateTransactionCache(transactions.map((t) =>
        ids.includes(t.id)
          ? { ...t, category_id: categoryId, subcategory_id: null, queued: true }
          : t
      ))
      return { error: null, queued: true }
    }
    const { error } = await supabase
      .from('transactions')
      .update({ category_id: categoryId, subcategory_id: null })
      .in('id', ids)
      .eq('user_id', user.id)
    if (!error) await fetch()
    return toResult(error, { action: 'save' })
  }

  /**
   * Saves an import in one insert. The database records each transfer into a credit card as a
   * payment in the same insert (LED-270, LED-296), so the card views are asked to re-read when the
   * import held one. A queued import gets them when it drains.
   */
  const bulkCreateTransactions = async (
    rows: TransactionUpsertValues[],
  ): Promise<MutationResult & { imported: number }> => {
    if (!user) return { error: 'Not authenticated', imported: 0 }
    if (!navigator.onLine) {
      const now = new Date().toISOString()
      // One id per row, shared by the optimistic row and the queued insert, so an edit or delete
      // before sync targets the row the database will hold, and a replay is recognised (LED-298).
      const ids = rows.map(() => crypto.randomUUID())
      const optimistics = rows.map((values, index) => ({
        ...buildOptimisticTransaction({ values, userId: user.id, now, id: ids[index] }),
        queued: true,
      }))
      // One queue write for the whole import: all of it is stored, or none of it is shown
      // (LED-303). Then one list update and one balance pass, so one cache write and one notice
      // each, however many rows (LED-318).
      const { error } = await enqueueMany(rows.map((values, index) => insertItem(values, user.id, ids[index])))
      if (error) return { error, imported: 0 }
      const filtered = optimistics.filter((tx) => txMatchesFilters(tx, filters))
      if (filtered.length) {
        updateTransactionCache(limitTransactions([...filtered, ...transactions], filters.limit))
      }
      optimisticAccountDelta((accounts) => rows.reduce((next, values) => applyTxDelta(next, values), accounts))
      return { error: null, imported: rows.length }
    }
    const { data: saved, error } = await supabase
      .from('transactions')
      .insert(rows.map((row) => ({ ...withTransactionDefaults(row), user_id: user.id })))
      .select('id, type, to_account_id, amount, exchange_rate, destination_amount, date')
    if (!error) await fetch()
    if (!error && saved) {
      const savedRows = saved as SavedImportRow[]
      const cardIds = [...new Set(savedRows.filter((row) => row.type === 'transfer' && row.to_account_id).map((row) => row.to_account_id!))]
      if (cardIds.length) {
        const { data: destinations } = await supabase.from('accounts').select('*').in('id', cardIds)
        if (importedCardPayments(savedRows, (destinations ?? []) as Account[]).length > 0) {
          notifyAccountsRefresh()
          notifyCardPaymentsRefresh()
        }
      }
    }
    return { ...toResult(error, { action: 'save' }), imported: error ? 0 : rows.length }
  }

  /**
   * Posts every recurring row that has come due. The database decides whether a row's next
   * occurrence is already posted (LED-232), so another browser or device never posts it twice.
   * A posted transfer into a credit card is recorded as a payment by the database in the same
   * insert (LED-190, LED-296); the card views are asked to re-read.
   */
  const generateDueRecurring = useCallback(async (): Promise<RecurringRun> => {
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
    let cardPaid = false
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
      if (!cardPaid && tx.type === 'transfer' && tx.to_account_id) {
        const { data: destination } = await supabase.from('accounts').select('id, type').eq('id', tx.to_account_id).maybeSingle()
        cardPaid = destination !== null && generatedCardPayment(tx, [destination as Account]) !== null
      }
    }
    if (posted > 0) await fetch()
    if (cardPaid) {
      notifyAccountsRefresh()
      notifyCardPaymentsRefresh()
    }
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
