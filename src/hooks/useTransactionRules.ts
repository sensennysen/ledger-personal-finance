import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Category } from '@/types'

export interface TransactionRule {
  id: string
  user_id: string
  keyword: string
  category_id: string | null
  type_hint: 'income' | 'expense' | 'transfer' | null
  priority: number
  created_at: string
  // joined
  category?: Category
}

export function useTransactionRules() {
  const { user } = useAuth()
  const [rules, setRules] = useState<TransactionRule[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRules = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('transaction_rules')
      .select('*, category:categories(id,name,icon,color,type,is_default,user_id,created_at,updated_at)')
      .eq('user_id', user.id)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
    setRules((data as TransactionRule[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  const createRule = useCallback(
    async (values: { keyword: string; category_id: string | null; type_hint: TransactionRule['type_hint']; priority?: number }) => {
      if (!user) return { error: 'Not authenticated' }
      const { error } = await supabase.from('transaction_rules').insert({
        user_id: user.id,
        keyword: values.keyword.trim().toLowerCase(),
        category_id: values.category_id,
        type_hint: values.type_hint,
        priority: values.priority ?? 0,
      })
      if (!error) await fetchRules()
      return { error: error?.message ?? null }
    },
    [user, fetchRules],
  )

  const updateRule = useCallback(
    async (id: string, values: Partial<Omit<TransactionRule, 'id' | 'user_id' | 'created_at' | 'category'>>) => {
      const { error } = await supabase.from('transaction_rules').update(values).eq('id', id)
      if (!error) await fetchRules()
      return { error: error?.message ?? null }
    },
    [fetchRules],
  )

  const deleteRule = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('transaction_rules').delete().eq('id', id)
      if (!error) setRules((prev) => prev.filter((r) => r.id !== id))
      return { error: error?.message ?? null }
    },
    [],
  )

  /** Given a description string, return the best matching rule (highest priority, first match). */
  const matchRule = useCallback(
    (description: string): TransactionRule | null => {
      if (!description) return null
      const lower = description.toLowerCase()
      const sorted = [...rules].sort((a, b) => b.priority - a.priority)
      return sorted.find((r) => lower.includes(r.keyword)) ?? null
    },
    [rules],
  )

  return { rules, loading, createRule, updateRule, deleteRule, matchRule }
}
