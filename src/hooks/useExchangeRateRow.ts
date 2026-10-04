import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { readCache, writeCache } from '@/lib/dataCache'
import { parseRateRow, type RateRow, type RateTable } from '@/lib/exchangeRates'
import { describeDataError, type DescribedError } from '@/lib/dataErrors'

const COLUMNS = 'base, rates, overrides, as_of, fetched_at'

// The user's exchange_rates row, read plainly with no feed fetch and no ExchangeRatesProvider:
// that provider needs useAccounts, which needs the notification surface, which is the LED-136
// trap on the public data-deletion page (knowledge/patterns/hooks-on-public-pages.md). Export
// card only (LED-180).
export function useExchangeRateRow() {
  const { user } = useAuth()
  const [table, setTable] = useState<RateTable | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadFailure, setLoadFailure] = useState<DescribedError | null>(null)

  const fetch = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    const cacheKey = `${user.id}:exchange_rates`
    const cached = readCache<RateRow>(cacheKey)
    if (cached) {
      setTable(parseRateRow(cached))
      setLoading(false)
    } else {
      setLoading(true)
    }
    if (!navigator.onLine) return

    const { data, error } = await supabase
      .from('exchange_rates')
      .select(COLUMNS)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      setLoadFailure(describeDataError(error, { action: 'load', entity: 'exchange rate' }))
      setLoading(false)
      return
    }

    setLoadFailure(null)
    setTable(parseRateRow(data as RateRow | null))
    if (data) writeCache(cacheKey, data)
    setLoading(false)
  }, [user])

  useEffect(() => {
    queueMicrotask(() => {
      void fetch()
    })
  }, [fetch])

  return { table, loading, error: loadFailure?.message ?? null, refetch: fetch }
}
