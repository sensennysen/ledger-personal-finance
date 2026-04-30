import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Account } from '@/types'

export function useAccounts() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
    if (error) setError(error.message)
    else setAccounts(data as Account[])
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
    const { error } = await supabase.from('accounts').update(values).eq('id', id)
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  const deleteAccount = async (id: string) => {
    const { error } = await supabase
      .from('accounts')
      .update({ is_active: false })
      .eq('id', id)
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  return { accounts, loading, error, refetch: fetch, createAccount, updateAccount, deleteAccount }
}
