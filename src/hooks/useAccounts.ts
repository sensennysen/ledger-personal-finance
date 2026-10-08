import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useNotify } from '@/contexts/notificationState'
import { BALANCE_ADJUSTMENT_DESCRIPTION, DEFAULT_CURRENCY } from '@/constants/accounts'
import { writeCache } from '@/lib/dataCache'
import { invalidateAfterWrite, useEntityQuery } from '@/hooks/useEntityQuery'
import { getLocalDateString } from '@/lib/utils'
import { planAccountSave, type BalanceAdjustment } from '@/lib/accountAdjustment'
import type { Account } from '@/types'
import { toResult, type MutationResult } from '@/lib/dataErrors'
import { eitherAccountFilter } from '@/lib/accountFilter'

const NO_ACCOUNTS: Account[] = []

/**
 * The user's accounts. Pickers and screens see active accounts only; `includeArchived` reads every
 * account for the data export, which must keep archived accounts and the history they carry (LED-309).
 * The two reads cache under separate keys, so an archived account never reaches a picker.
 */
export function useAccounts({ includeArchived = false }: { includeArchived?: boolean } = {}) {
  const cacheSuffix = includeArchived ? ':all' : ''
  const { user } = useAuth()
  const notify = useNotify()
  const queryClient = useQueryClient()

  // Shared by every instance with the same key: the layout, the page and the payment hooks read once (LED-321).
  const { data, loading, error, errorDetail, refetch: fetch, queryKey } = useEntityQuery<Account[]>({
    entity: 'accounts',
    offlineLabel: 'your accounts',
    params: { includeArchived },
    cacheKey: (userId) => `${userId}:accounts${cacheSuffix}`,
    read: (userId, retry, signal) => {
      let query = supabase
        .from('accounts')
        .select('*')
        .eq('user_id', userId)
      if (!includeArchived) query = query.eq('is_active', true)
      return query
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
        .abortSignal(signal)
        .retry(retry)
        .overrideTypes<Account[]>()
    },
  })
  const accounts = data ?? NO_ACCOUNTS

  const createAccount = async (values: Omit<Account, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<MutationResult> => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) return { error: 'Connect to the internet to add an account.' }
    const { error } = await supabase.from('accounts').insert({
      sort_order: accounts.length,
      ...values,
      user_id: user.id,
    })
    if (!error) await invalidateAfterWrite('accounts')
    return toResult(error, { action: 'save', entity: 'account' })
  }

  const updateAccount = async (id: string, values: Partial<Account>): Promise<MutationResult> => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) return { error: 'Connect to the internet to edit this account.' }
    const { error } = await supabase.from('accounts').update(values).eq('id', id).eq('user_id', user.id)
    if (!error) await invalidateAfterWrite('accounts')
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
    await invalidateAfterWrite('transactions')
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

    await invalidateAfterWrite('accounts')
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
        .or(eitherAccountFilter(id))
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
    if (!error) await invalidateAfterWrite('accounts')
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
    queryClient.setQueryData(queryKey, nextAccounts)
    writeCache(`${user.id}:accounts${cacheSuffix}`, nextAccounts)

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

  return { accounts, loading, error, errorDetail, refetch: fetch, createAccount, updateAccount, updateAccountWithAdjustment, deleteAccount, updateAccountOrder }
}
