import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { readCache, writeCache } from '@/lib/dataCache'
import type { Subcategory } from '@/types'

export function useSubcategories(categoryId: string | null) {
  const { user } = useAuth()
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async () => {
    if (!user || !categoryId) {
      setSubcategories([])
      return
    }

    const cacheKey = `${user.id}:subcategories:${categoryId}`
    const cached = readCache<Subcategory[]>(cacheKey)
    if (cached) setSubcategories(cached)

    setLoading(true)
    const { data, error } = await supabase
      .from('subcategories')
      .select('*')
      .eq('user_id', user.id)
      .eq('category_id', categoryId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
      .order('created_at', { ascending: true })
    if (!error && data) {
      setSubcategories(data as Subcategory[])
      writeCache(cacheKey, data)
    }
    setLoading(false)
  }, [user, categoryId])

  useEffect(() => {
    queueMicrotask(() => {
      void fetch()
    })
  }, [fetch])

  const createSubcategory = async (name: string) => {
    if (!user || !categoryId) return { error: 'Not authenticated' }
    const { error } = await supabase
      .from('subcategories')
      .insert({ name, category_id: categoryId, user_id: user.id, sort_order: subcategories.length })
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  const updateSubcategory = async (id: string, values: Partial<Subcategory>) => {
    if (!user) return { error: 'Not authenticated' }
    const { error } = await supabase
      .from('subcategories')
      .update(values)
      .eq('id', id)
      .eq('user_id', user.id)
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  const deleteSubcategory = async (id: string) => {
    if (!user) return { error: 'Not authenticated' }
    const { error } = await supabase
      .from('subcategories')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  const updateSubcategoryOrder = async (orderedIds: string[]) => {
    if (!user || !categoryId) return { error: 'Not authenticated' }

    const orderMap = new Map(orderedIds.map((id, index) => [id, index]))
    const nextSubcategories = subcategories
      .map((subcategory) => ({
        ...subcategory,
        sort_order: orderMap.get(subcategory.id) ?? subcategory.sort_order ?? subcategories.length,
      }))
      .sort(
        (a, b) =>
          (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
          a.name.localeCompare(b.name) ||
          a.created_at.localeCompare(b.created_at)
      )

    setSubcategories(nextSubcategories)
    writeCache(`${user.id}:subcategories:${categoryId}`, nextSubcategories)

    const results = await Promise.all(
      orderedIds.map((id, sort_order) =>
        supabase
          .from('subcategories')
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

  return { subcategories, loading, refetch: fetch, createSubcategory, updateSubcategory, deleteSubcategory, updateSubcategoryOrder }
}

// Fetch all subcategories for a user at once (keyed by category_id)
export function useAllSubcategories() {
  const { user } = useAuth()
  const [subcategoriesByCategoryId, setSubcategoriesByCategoryId] = useState<Record<string, Subcategory[]>>({})
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('subcategories')
      .select('*')
      .eq('user_id', user.id)
      .order('category_id', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
      .order('created_at', { ascending: true })
    if (!error && data) {
      const map: Record<string, Subcategory[]> = {}
      for (const sub of data as Subcategory[]) {
        if (!map[sub.category_id]) map[sub.category_id] = []
        map[sub.category_id].push(sub)
      }
      setSubcategoriesByCategoryId(map)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    queueMicrotask(() => {
      void fetch()
    })
  }, [fetch])

  return { subcategoriesByCategoryId, loading, refetch: fetch }
}
