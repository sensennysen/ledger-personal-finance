import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { ExistingTx } from '@/lib/importDuplicates'
import { readAllPages } from '@/lib/pagedRead'
import { describeDataError, type DescribedError } from '@/lib/dataErrors'

interface CheckResult {
  key: string
  existing: ExistingTx[]
  error: DescribedError | null
}

/**
 * Reads the account's transactions inside the file's date span, including
 * transfers into it (LED-75), so the import can flag duplicates (LED-73). A failed read is reported, never treated as
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
      // PostgREST caps a response at 1,000 rows; a large statement spans more.
      const { rows, error } = await readAllPages<ExistingTx>((from, to) =>
        supabase
          .from('transactions')
          .select('id, date, amount, type, description, account_id, to_account_id, exchange_rate')
          .eq('user_id', user.id)
          .or(`account_id.eq.${accountId},to_account_id.eq.${accountId}`)
          .gte('date', span.start)
          .lte('date', span.end)
          .order('date', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
      )
      if (cancelled) return
      setResult({ key, existing: error ? [] : rows, error: describeDataError(error, { action: 'load' }) })
    }

    run().catch((error: unknown) => {
      if (!cancelled) {
        setResult({ key, existing: [], error: describeDataError(error instanceof Error ? error : String(error), { action: 'load' }) })
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
    error: current?.error?.message ?? null,
    errorDetail: current?.error?.detail ?? null,
    retry: () => setAttempt((value) => value + 1),
  }
}
