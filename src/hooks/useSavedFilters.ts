import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { readAllPages } from '@/lib/pagedRead'
import { describeDataError, toResult, type DescribedError, type MutationResult } from '@/lib/dataErrors'
import {
  normalizeFilterName,
  parseSavedFilters,
  serializeFilter,
  type ActivityFilter,
  type SavedFilter,
  type SavedFilterRow,
} from '@/lib/savedFilters'

/**
 * The user's saved Activity filters (LED-138). Each caller owns its own copy: the palette
 * mounts one when it opens and Activity mounts one, so a filter saved on Activity shows in
 * the palette the next time it opens. A failed read keeps what was loaded and says so.
 */
export function useSavedFilters(enabled = true) {
  const { user } = useAuth()
  const [filters, setFilters] = useState<SavedFilter[]>([])
  const [skipped, setSkipped] = useState(0)
  const [loading, setLoading] = useState(enabled)
  const [failure, setFailure] = useState<DescribedError | null>(null)

  const refetch = useCallback(async () => {
    if (!user || !enabled) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { rows, error } = await readAllPages<SavedFilterRow>((from, to) =>
      supabase
        .from('saved_filters')
        .select('id, name, filter')
        .eq('user_id', user.id)
        .order('name', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    )
    if (error) {
      setFailure(describeDataError(error, { action: 'load', entity: 'saved filter' }))
      setLoading(false)
      return
    }
    const parsed = parseSavedFilters(rows)
    setFailure(null)
    setFilters(parsed.filters)
    setSkipped(parsed.skipped)
    setLoading(false)
  }, [enabled, user])

  useEffect(() => {
    queueMicrotask(() => {
      void refetch()
    })
  }, [refetch])

  const save = useCallback(
    async (name: string, filter: ActivityFilter): Promise<MutationResult> => {
      if (!user) return { error: 'Not authenticated' }
      const { error } = await supabase
        .from('saved_filters')
        .insert({ user_id: user.id, name: normalizeFilterName(name), filter: serializeFilter(filter) })
      if (!error) await refetch()
      return toResult(error, { action: 'save', entity: 'saved filter' })
    },
    [refetch, user],
  )

  const rename = useCallback(
    async (id: string, name: string): Promise<MutationResult> => {
      if (!user) return { error: 'Not authenticated' }
      const { error } = await supabase
        .from('saved_filters')
        .update({ name: normalizeFilterName(name) })
        .eq('id', id)
        .eq('user_id', user.id)
      if (!error) await refetch()
      return toResult(error, { action: 'save', entity: 'saved filter' })
    },
    [refetch, user],
  )

  const remove = useCallback(
    async (id: string): Promise<MutationResult> => {
      if (!user) return { error: 'Not authenticated' }
      const { error } = await supabase.from('saved_filters').delete().eq('id', id).eq('user_id', user.id)
      if (!error) setFilters((prev) => prev.filter((saved) => saved.id !== id))
      return toResult(error, { action: 'delete', entity: 'saved filter' })
    },
    [user],
  )

  return {
    filters,
    /** Rows stored in a form this version cannot read; they are not shown. */
    skipped,
    loading,
    error: failure?.message ?? null,
    errorDetail: failure?.detail ?? null,
    refetch,
    save,
    rename,
    remove,
  }
}
