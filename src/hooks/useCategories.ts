import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Category } from '@/types'

export function useCategories() {
  const { user } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true })
    if (error) setError(error.message)
    else setCategories(data as Category[])
    setLoading(false)
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  const createCategory = async (
    values: Omit<Category, 'id' | 'user_id' | 'is_default' | 'created_at' | 'updated_at'>
  ) => {
    if (!user) return { error: 'Not authenticated' }
    const { error } = await supabase
      .from('categories')
      .insert({ ...values, user_id: user.id, is_default: false })
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  const updateCategory = async (id: string, values: Partial<Category>) => {
    const { error } = await supabase.from('categories').update(values).eq('id', id)
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  const deleteCategory = async (id: string) => {
    const { error } = await supabase.from('categories').delete().eq('id', id).eq('is_default', false)
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  return { categories, loading, error, refetch: fetch, createCategory, updateCategory, deleteCategory }
}
