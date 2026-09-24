import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { readCache, writeCache } from '@/lib/dataCache'
import type { Category } from '@/types'
import { describeDataError, toResult, type DescribedError, type MutationResult } from '@/lib/dataErrors'

export function useCategories() {
  const { user } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailure, setLoadFailure] = useState<DescribedError | null>(null)

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
      setLoadFailure(describeDataError(error, { action: 'load' }))
    } else {
      setLoadFailure(null)
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
  ): Promise<MutationResult> => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) return { error: 'Connect to the internet to add a category.' }
    const { error } = await supabase
      .from('categories')
      .insert({ ...values, user_id: user.id, is_default: false, sort_order: categories.length })
    if (!error) await fetch()
    return toResult(error, { action: 'save', entity: 'category' })
  }

  const updateCategory = async (id: string, values: Partial<Category>): Promise<MutationResult> => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) return { error: 'Connect to the internet to edit this category.' }
    const { error } = await supabase.from('categories').update(values).eq('id', id).eq('user_id', user.id)
    if (!error) await fetch()
    return toResult(error, { action: 'save', entity: 'category' })
  }

  const deleteCategory = async (id: string): Promise<MutationResult> => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) return { error: 'Connect to the internet to remove this category.' }
    const { error } = await supabase.from('categories').delete().eq('id', id).eq('user_id', user.id)
    if (!error) await fetch()
    return toResult(error, { action: 'delete', entity: 'category' })
  }

  const updateCategoryOrder = async (orderedIds: string[]): Promise<MutationResult> => {
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
      return toResult(failed.error, { action: 'save' })
    }
    return { error: null }
  }

  const error = loadFailure?.message ?? null
  const errorDetail = loadFailure?.detail ?? null
  return { categories, loading, error, errorDetail, refetch: fetch, createCategory, updateCategory, deleteCategory, updateCategoryOrder }
}
