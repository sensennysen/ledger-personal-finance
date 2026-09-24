import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { readAllPages } from '@/lib/pagedRead'
import { buildPayeeMemory, type CategoryRule, type HistoryTx, type PayeeMemory } from '@/lib/importCategories'
import type { TransferRule } from '@/lib/importTransfer'

/** A rule suggests a category, and its type hint can suggest a transfer. */
export type ImportRule = CategoryRule & TransferRule

interface MemoryResult {
  key: string
  memory: PayeeMemory
  rules: ImportRule[]
  error: string | null
}

const EMPTY_MEMORY: PayeeMemory = new Map()

/**
 * What the import needs to suggest categories (LED-74): the user's rules and
 * a payee → category memory built from every categorised transaction. Read
 * only while the dialog has a file. A failed read is reported; the import can
 * still go ahead, with every row left for the user to categorise.
 */
export function useImportCategoryMemory(enabled: boolean) {
  const { user } = useAuth()
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<MemoryResult | null>(null)

  const key = enabled && user ? `${user.id}|${attempt}` : ''

  useEffect(() => {
    if (!key || !user) return
    let cancelled = false

    const run = async () => {
      const [history, rules] = await Promise.all([
        readAllPages<HistoryTx>((from, to) =>
          supabase
            .from('transactions')
            .select('description, category_id, type, date')
            .eq('user_id', user.id)
            .not('category_id', 'is', null)
            .order('date', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to),
        ),
        supabase.from('transaction_rules').select('keyword, category_id, type_hint, priority').eq('user_id', user.id),
      ])
      if (cancelled) return
      const error = history.error ?? rules.error?.message ?? null
      setResult({
        key,
        memory: error ? EMPTY_MEMORY : buildPayeeMemory(history.rows),
        rules: error ? [] : ((rules.data ?? []) as ImportRule[]),
        error,
      })
    }

    run().catch((error: unknown) => {
      if (!cancelled) {
        setResult({ key, memory: EMPTY_MEMORY, rules: [], error: error instanceof Error ? error.message : 'Network error' })
      }
    })
    return () => {
      cancelled = true
    }
  }, [key, user])

  const current = result && result.key === key ? result : null
  return {
    memory: current?.memory ?? EMPTY_MEMORY,
    rules: current?.rules ?? [],
    loading: Boolean(key) && !current,
    error: current?.error ?? null,
    retry: () => setAttempt((value) => value + 1),
  }
}
