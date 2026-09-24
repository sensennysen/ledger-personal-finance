import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { ExistingTx } from '@/lib/importDuplicates'

const PAGE_SIZE = 1000

interface CheckResult {
  key: string
  existing: ExistingTx[]
  error: string | null
}

/**
 * Reads the account's transactions inside the file's date span so the import
 * can flag duplicates (LED-73). A failed read is reported, never treated as
 * "no duplicates": the caller blocks the import until the check succeeds.
 */
export function useImportDuplicates(accountId: string, span: { start: string; end: string } | null) {
  const { user } = useAuth()
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<CheckResult | null>(null)

  const enabled = Boolean(user && accountId && span)
  const key = enabled ? `${user!.id}|${accountId}|${span!.start}|${span!.end}|${attempt}` : ''

  useEffect(() => {
    if (!key || !user || !span) return
    let cancelled = false

    const run = async () => {
      const existing: ExistingTx[] = []
      // PostgREST caps a response at 1,000 rows; a large statement spans more.
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabase
          .from('transactions')
          .select('id, date, amount, type, description')
          .eq('user_id', user.id)
          .eq('account_id', accountId)
          .gte('date', span.start)
          .lte('date', span.end)
          .order('date', { ascending: true })
          .order('id', { ascending: true })
          .range(from, from + PAGE_SIZE - 1)
        if (cancelled) return
        if (error) {
          setResult({ key, existing: [], error: error.message })
          return
        }
        existing.push(...((data ?? []) as ExistingTx[]))
        if (!data || data.length < PAGE_SIZE) break
      }
      setResult({ key, existing, error: null })
    }

    run().catch((error: unknown) => {
      if (!cancelled) {
        setResult({ key, existing: [], error: error instanceof Error ? error.message : 'Network error' })
      }
    })
    return () => {
      cancelled = true
    }
    // span is captured through key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const current = result && result.key === key ? result : null
  return {
    existing: current?.existing ?? [],
    loading: enabled && !current,
    error: current?.error ?? null,
    retry: () => setAttempt((value) => value + 1),
  }
}
