import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { readCache, writeCache } from '@/lib/dataCache'
import type { Category } from '@/types'

export function useCategories() {
  const { user } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    const cacheKey = `${user.id}:categories`
    const cached = readCache<Category[]>(cacheKey)
    if (cached) {
      setCategories(cached)
      setLoading(false)
    } else {
      setLoading(true)
    }
    if (!navigator.onLine) return
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .order('is_default', { ascending: false })
      .order('name', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) {
      setError(error.message)
    } else {
      setCategories(data as Category[])
      writeCache(cacheKey, data)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    queueMicrotask(() => {
      void fetch()
    })
  }, [fetch])

  const createCategory = async (
    values: Omit<Category, 'id' | 'user_id' | 'is_default' | 'created_at' | 'updated_at'>
  ) => {
    if (!user) return { error: 'Not authenticated' }
    const { error } = await supabase
      .from('categories')
      .insert({ ...values, user_id: user.id, is_default: false, sort_order: categories.length })
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  const updateCategory = async (id: string, values: Partial<Category>) => {
    if (!user) return { error: 'Not authenticated' }
    const { error } = await supabase.from('categories').update(values).eq('id', id).eq('user_id', user.id)
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  const deleteCategory = async (id: string) => {
    if (!user) return { error: 'Not authenticated' }
    const { error } = await supabase.from('categories').delete().eq('id', id).eq('user_id', user.id)
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  const updateCategoryOrder = async (orderedIds: string[]) => {
    if (!user) return { error: 'Not authenticated' }

    const orderMap = new Map(orderedIds.map((id, index) => [id, index]))
    const nextCategories = categories
      .map((category) => ({
        ...category,
        sort_order: orderMap.get(category.id) ?? category.sort_order ?? categories.length,
      }))
      .sort(
        (a, b) =>
          (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
          a.name.localeCompare(b.name) ||
          a.created_at.localeCompare(b.created_at)
      )

    setCategories(nextCategories)
    writeCache(`${user.id}:categories`, nextCategories)

    const results = await Promise.all(
      orderedIds.map((id, sort_order) =>
        supabase
          .from('categories')
          .update({ sort_order })
          .eq('id', id)
          .eq('user_id', user.id)
      )
    )
    const failed = results.find((result) => result.error)
    if (failed?.error) {
      await fetch()
      return { error: failed.error.message }
    }
    return { error: null }
  }

  return { categories, loading, error, refetch: fetch, createCategory, updateCategory, deleteCategory, updateCategoryOrder }
}
