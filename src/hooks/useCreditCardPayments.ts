import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { readCache, writeCache } from '@/lib/dataCache'
import { readWithPolicy } from '@/lib/readRetry'
import type { CreditCardPayment } from '@/types'
import { describeDataError, type DescribedError } from '@/lib/dataErrors'

// Every credit card payment for the user, with no account filter. useCardPayment records and
// updates one payment as part of a transfer; this is a plain read for the data-export card
// (public page, LED-180) — needs only useAuth, no notification surface.
export function useCreditCardPayments() {
  const { user } = useAuth()
  const [payments, setPayments] = useState<CreditCardPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailure, setLoadFailure] = useState<DescribedError | null>(null)

  const fetch = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    const cacheKey = `${user.id}:credit_card_payments`
    const cached = readCache<CreditCardPayment[]>(cacheKey)
    if (cached) {
      setPayments(cached)
      setLoading(false)
    } else {
      setLoading(true)
    }
    if (!navigator.onLine) return

    // Fails fast on a first load, keeps the library retries when the cache is on screen (LED-242).
    const { data, error } = await readWithPolicy((retry) => supabase
      .from('credit_card_payments')
      .select('*')
      .eq('user_id', user.id)
      .order('payment_date', { ascending: false })
      .retry(retry), { background: cached !== null })

    if (error) {
      setLoadFailure(describeDataError(error, { action: 'load' }))
      setLoading(false)
      return
    }

    setLoadFailure(null)
    setPayments(data as CreditCardPayment[])
    writeCache(cacheKey, data)
    setLoading(false)
  }, [user])

  useEffect(() => {
    queueMicrotask(() => {
      void fetch()
    })
  }, [fetch])

  return { payments, loading, error: loadFailure?.message ?? null, refetch: fetch }
}
