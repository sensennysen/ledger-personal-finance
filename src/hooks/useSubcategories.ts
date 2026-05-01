import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
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
    setLoading(true)
    const { data, error } = await supabase
      .from('subcategories')
      .select('*')
      .eq('user_id', user.id)
      .eq('category_id', categoryId)
      .order('name', { ascending: true })
    if (!error) setSubcategories(data as Subcategory[])
    setLoading(false)
  }, [user, categoryId])

  useEffect(() => { fetch() }, [fetch])

  const createSubcategory = async (name: string) => {
    if (!user || !categoryId) return { error: 'Not authenticated' }
    const { error } = await supabase
      .from('subcategories')
      .insert({ name, category_id: categoryId, user_id: user.id })
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  const updateSubcategory = async (id: string, name: string) => {
    if (!user) return { error: 'Not authenticated' }
    const { error } = await supabase
      .from('subcategories')
      .update({ name })
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

  return { subcategories, loading, refetch: fetch, createSubcategory, updateSubcategory, deleteSubcategory }
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
      .order('name', { ascending: true })
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

  useEffect(() => { fetch() }, [fetch])

  return { subcategoriesByCategoryId, loading, refetch: fetch }
}
