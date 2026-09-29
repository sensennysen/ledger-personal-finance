import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { describeDataError, type DescribedError } from '@/lib/dataErrors'
import { readAllPages } from '@/lib/pagedRead'
import { subcategoryCounts, type UsageTx } from '@/lib/categoryUsage'

/**
 * The raw rows behind the Categories screen's usage columns: every categorised
 * transaction (narrow columns, paged past PostgREST's 1,000-row cap) and the
 * subcategory counts. The figures themselves come from buildCategoryUsage, so the
 * cycle and currency stay the page's call. `usable` is false until a read has
 * succeeded; a failed read must never be shown as zero usage.
 */
export function useCategoryUsage() {
  const { user } = useAuth()
  const [txs, setTxs] = useState<UsageTx[]>([])
  const [subCounts, setSubCounts] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [usable, setUsable] = useState(false)
  const [failure, setFailure] = useState<DescribedError | null>(null)
  const requestId = useRef(0)

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    const request = ++requestId.current
    setLoading(true)
    setFailure(null)

    const { rows, error: txError } = await readAllPages<UsageTx>(
      (from, to) =>
        supabase
          .from('transactions')
          .select('category_id, subcategory_id, type, amount, currency, exchange_rate, date')
          .eq('user_id', user.id)
          .not('category_id', 'is', null)
          .order('date', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
      undefined,
      () => request !== requestId.current,
    )
    if (request !== requestId.current) return
    if (txError) {
      setFailure(describeDataError(txError, { action: 'load', entity: 'category usage' }))
      setLoading(false)
      return
    }

    const { data: subs, error: subError } = await supabase
      .from('subcategories')
      .select('category_id')
      .eq('user_id', user.id)
    if (request !== requestId.current) return
    if (subError) {
      setFailure(describeDataError(subError, { action: 'load', entity: 'category usage' }))
      setLoading(false)
      return
    }

    setTxs(rows)
    setSubCounts(subcategoryCounts((subs ?? []) as { category_id: string }[]))
    setUsable(true)
    setLoading(false)
  }, [user])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  return {
    txs,
    subCounts,
    loading,
    /** True once a read has succeeded; stays true (with `error` set) if a refresh fails, so the last figures still show. */
    usable,
    error: failure?.message ?? null,
    errorDetail: failure?.detail ?? null,
    refetch: load,
  }
}
