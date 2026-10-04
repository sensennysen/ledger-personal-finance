import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { readCache, writeCache } from '@/lib/dataCache'
import { readWithPolicy } from '@/lib/readRetry'
import type { Category, Subcategory } from '@/types'
import { parseMergeResult, planSubcategoryMerge, type MergePreview } from '@/lib/categoryMerge'
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
    // Fails fast on a first load, keeps the library retries when the cache is on screen (LED-242).
    const { data, error } = await readWithPolicy((retry) => supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .order('is_default', { ascending: false })
      .order('name', { ascending: true })
      .order('created_at', { ascending: true })
      .retry(retry), { background: cached !== null })
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
    // A reorder is one write per category, so it is not queued; say so rather than do nothing.
    if (!navigator.onLine) return { error: 'Connect to the internet to change the order.' }

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

  /** What a merge of source into target would move, for the confirmation (LED-239). */
  const previewMerge = async (
    sourceId: string,
    targetId: string,
  ): Promise<{ preview: MergePreview | null; error: string | null }> => {
    if (!user) return { preview: null, error: 'Not authenticated' }
    if (!navigator.onLine) return { preview: null, error: 'Connect to the internet to merge categories.' }
    const count = (table: 'transactions' | 'budgets' | 'transaction_rules' | 'loan_purchases', categoryId: string) =>
      supabase.from(table).select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('category_id', categoryId)
    const [transactions, budgets, rules, loanPurchases, activeBudgets, subs] = await Promise.all([
      count('transactions', sourceId),
      count('budgets', sourceId),
      count('transaction_rules', sourceId),
      count('loan_purchases', sourceId),
      supabase
        .from('budgets')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_active', true)
        .in('category_id', [sourceId, targetId]),
      supabase
        .from('subcategories')
        .select('id, name, category_id, sort_order, created_at')
        .eq('user_id', user.id)
        .in('category_id', [sourceId, targetId]),
    ])
    const failed = [transactions, budgets, rules, loanPurchases, activeBudgets, subs].find((result) => result.error)
    if (failed?.error) return { preview: null, error: toResult(failed.error, { action: 'load' }).error }
    const rows = (subs.data ?? []) as Pick<Subcategory, 'id' | 'name' | 'category_id' | 'sort_order' | 'created_at'>[]
    const plan = planSubcategoryMerge(
      rows.filter((row) => row.category_id === sourceId),
      rows.filter((row) => row.category_id === targetId),
    )
    return {
      preview: {
        transactions: transactions.count ?? 0,
        subcategoriesMoved: plan.moved,
        subcategoriesFolded: plan.folded,
        budgets: budgets.count ?? 0,
        rules: rules.count ?? 0,
        loanPurchases: loanPurchases.count ?? 0,
        targetActiveBudgets: activeBudgets.count ?? 0,
      },
      error: null,
    }
  }

  /** Merges source into target in one call (public.merge_category); an rpc is not queueable. */
  const mergeCategory = async (
    sourceId: string,
    targetId: string,
  ): Promise<MutationResult & { result?: MergePreview }> => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) return { error: 'Connect to the internet to merge categories.' }
    const { data, error } = await supabase.rpc('merge_category', { p_source: sourceId, p_target: targetId })
    if (error) return toResult(error, { action: 'save', entity: 'category' })
    await fetch()
    return { error: null, result: parseMergeResult(data as Record<string, unknown> | null) }
  }

  const error = loadFailure?.message ?? null
  const errorDetail = loadFailure?.detail ?? null
  return { categories, loading, error, errorDetail, refetch: fetch, createCategory, updateCategory, deleteCategory, updateCategoryOrder, previewMerge, mergeCategory }
}
