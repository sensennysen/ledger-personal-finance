import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { BALANCE_ADJUSTMENT_DESCRIPTION, DEFAULT_CURRENCY } from '@/constants/accounts'
import { readCache, writeCache } from '@/lib/dataCache'
import type { Account } from '@/types'

export function useAccounts() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
      .order('created_at', { ascending: true })
    if (error) {
      setError(error.message)
    } else {
      setAccounts(data as Account[])
      writeCache(cacheKey, data)
    }
    setLoading(false)
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  const createAccount = async (values: Omit<Account, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return { error: 'Not authenticated' }
    const { error } = await supabase.from('accounts').insert({ ...values, user_id: user.id })
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  const updateAccount = async (id: string, values: Partial<Account>) => {
    if (!user) return { error: 'Not authenticated' }
    const { error } = await supabase.from('accounts').update(values).eq('id', id).eq('user_id', user.id)
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  const updateAccountWithAdjustment = async (id: string, values: Partial<Account>, oldBalance: number) => {
    if (!user) return { error: 'Not authenticated' }
    const newBalance = values.balance ?? oldBalance

    // Update account fields; if balance changed, omit it — the transaction trigger handles it
    const updatePayload: Partial<Account> = { ...values }
    if (newBalance !== oldBalance) {
      delete updatePayload.balance
    }

    const { error: updateError } = await supabase.from('accounts').update(updatePayload).eq('id', id).eq('user_id', user.id)
    if (updateError) return { error: updateError.message }

    if (newBalance !== oldBalance) {
      const diff = newBalance - oldBalance
      const account = accounts.find((a) => a.id === id)
      const { error: txError } = await supabase.from('transactions').insert({
        user_id: user.id,
        account_id: id,
        type: diff > 0 ? 'income' : 'expense',
        amount: Math.abs(diff),
        currency: account?.currency ?? values.currency ?? DEFAULT_CURRENCY,
        exchange_rate: 1,
        description: BALANCE_ADJUSTMENT_DESCRIPTION,
        date: new Date().toISOString().split('T')[0],
      })
      if (txError) return { error: txError.message }
    }

    await fetch()
    return { error: null }
  }

  const deleteAccount = async (id: string) => {
    if (!user) return { error: 'Not authenticated' }
    const { error } = await supabase
      .from('accounts')
      .update({ is_active: false })
      .eq('id', id)
      .eq('user_id', user.id)
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  return { accounts, loading, error, refetch: fetch, createAccount, updateAccount, updateAccountWithAdjustment, deleteAccount }
}
