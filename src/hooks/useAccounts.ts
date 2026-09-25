import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useNotify } from '@/contexts/notificationState'
import { BALANCE_ADJUSTMENT_DESCRIPTION, DEFAULT_CURRENCY } from '@/constants/accounts'
import { readCache, writeCache } from '@/lib/dataCache'
import { registerAccountsListener } from '@/lib/cacheEvents'
import { getLocalDateString } from '@/lib/utils'
import { planAccountSave, type BalanceAdjustment } from '@/lib/accountAdjustment'
import type { Account } from '@/types'
import { describeDataError, toResult, type DescribedError, type MutationResult } from '@/lib/dataErrors'

export function useAccounts() {
  const { user } = useAuth()
  const notify = useNotify()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailure, setLoadFailure] = useState<DescribedError | null>(null)

  const fetch = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    const cacheKey = `${user.id}:accounts`
    const cached = readCache<Account[]>(cacheKey)
    if (cached) {
      setAccounts(cached)
      setLoading(false)
    } else {
      setLoading(true)
    }
    if (!navigator.onLine) return
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) {
      setLoadFailure(describeDataError(error, { action: 'load' }))
    } else {
      setLoadFailure(null)
      setAccounts(data as Account[])
      writeCache(cacheKey, data)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    queueMicrotask(() => {
      void fetch()
    })
  }, [fetch])

  // Re-read cache when an offline transaction mutation updates account balances
  const reloadFromCache = useCallback(() => {
    if (!user) return
    const cached = readCache<Account[]>(`${user.id}:accounts`)
    if (cached) setAccounts(cached)
  }, [user])

  useEffect(() => registerAccountsListener(reloadFromCache), [reloadFromCache])

  const createAccount = async (values: Omit<Account, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<MutationResult> => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) return { error: 'Connect to the internet to add an account.' }
    const { error } = await supabase.from('accounts').insert({
      sort_order: accounts.length,
      ...values,
      user_id: user.id,
    })
    if (!error) await fetch()
    return toResult(error, { action: 'save', entity: 'account' })
  }

  const updateAccount = async (id: string, values: Partial<Account>): Promise<MutationResult> => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) return { error: 'Connect to the internet to edit this account.' }
    const { error } = await supabase.from('accounts').update(values).eq('id', id).eq('user_id', user.id)
    if (!error) await fetch()
    return toResult(error, { action: 'save', entity: 'account' })
  }

  // The account has already saved by the time this runs, so a failure is partial: Fix
  // reruns only this insert and never saves the account a second time.
  const recordBalanceAdjustment = async (accountId: string, adjustment: BalanceAdjustment, currency: string): Promise<void> => {
    if (!user) return
    const { error } = await supabase.from('transactions').insert({
      user_id: user.id,
      account_id: accountId,
      type: adjustment.type,
      amount: adjustment.amount,
      currency,
      exchange_rate: 1,
      description: BALANCE_ADJUSTMENT_DESCRIPTION,
      date: getLocalDateString(),
    })
    await fetch()
    if (!error) return
    notify({
      severity: 'partial',
      title: 'Account saved, balance adjustment not recorded',
      body: 'Your changes saved, but the balance still shows the old amount.',
      action: { label: 'Fix', run: () => void recordBalanceAdjustment(accountId, adjustment, currency) },
    })
  }

  const updateAccountWithAdjustment = async (id: string, values: Partial<Account>, oldBalance: number): Promise<MutationResult> => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) return { error: 'Connect to the internet to edit this account.' }

    // If the balance changed, omit it from the update: the transaction trigger handles it.
    const { updatePayload, adjustment } = planAccountSave(oldBalance, values)

    const { error: updateError } = await supabase.from('accounts').update(updatePayload).eq('id', id).eq('user_id', user.id)
    if (updateError) return toResult(updateError, { action: 'save', entity: 'account' })

    if (adjustment) {
      const account = accounts.find((a) => a.id === id)
      await recordBalanceAdjustment(id, adjustment, account?.currency ?? values.currency ?? DEFAULT_CURRENCY)
      return { error: null }
    }

    await fetch()
    return { error: null }
  }

  const deleteAccount = async (id: string): Promise<MutationResult> => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) return { error: 'Connect to the internet to remove this account.' }
    const targetAccount = accounts.find((account) => account.id === id)

    if (targetAccount?.type !== 'loan') {
      // Loan removal is an explicit archive operation and preserves its linked
      // history. Other accounts retain the stricter history protection.
      const { count, error: countError } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .or(`account_id.eq.${id},to_account_id.eq.${id}`)
        .eq('user_id', user.id)
      if (countError) return toResult(countError, { action: 'delete', entity: 'account' })
      if (count && count > 0) {
        return {
          error: `This account has ${count} transaction(s). Move or delete them before removing the account.`,
        }
      }
    }

    const { error } = await supabase
      .from('accounts')
      .update({ is_active: false })
      .eq('id', id)
      .eq('user_id', user.id)
    if (!error) await fetch()
    return toResult(error, { action: 'delete', entity: 'account' })
  }

  const updateAccountOrder = async (orderedIds: string[]): Promise<MutationResult> => {
    if (!user) return { error: 'Not authenticated' }
    // A reorder is one write per account, so it is not queued; say so rather than do nothing.
    if (!navigator.onLine) return { error: 'Connect to the internet to change the order.' }

    const orderMap = new Map(orderedIds.map((id, index) => [id, index]))
    const nextAccounts = accounts
      .map((account) => ({ ...account, sort_order: orderMap.get(account.id) ?? account.sort_order ?? accounts.length }))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.created_at.localeCompare(b.created_at))
    setAccounts(nextAccounts)
    writeCache(`${user.id}:accounts`, nextAccounts)

    const updates = orderedIds.map((id, sort_order) =>
      supabase
        .from('accounts')
        .update({ sort_order })
        .eq('id', id)
        .eq('user_id', user.id)
    )
    const results = await Promise.all(updates)
    const failed = results.find((result) => result.error)
    if (failed?.error) {
      await fetch()
      return toResult(failed.error, { action: 'save' })
    }
    return { error: null }
  }

  const error = loadFailure?.message ?? null
  const errorDetail = loadFailure?.detail ?? null
  return { accounts, loading, error, errorDetail, refetch: fetch, createAccount, updateAccount, updateAccountWithAdjustment, deleteAccount, updateAccountOrder }
}
