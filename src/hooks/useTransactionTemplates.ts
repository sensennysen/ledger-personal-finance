import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { readAllPages } from '@/lib/pagedRead'
import { readWithPolicy } from '@/lib/readRetry'
import { describeDataError, toResult, type DescribedError, type MutationResult } from '@/lib/dataErrors'
import type { TransactionFormValues } from '@/components/transactions/TransactionForm'
import {
  LEGACY_TEMPLATES_KEY,
  forgetLegacyTemplates,
  legacyTemplateRows,
  normalizeTemplateName,
  parseTemplateRows,
  serializeTemplateFields,
  shouldUploadLegacy,
  type TransactionTemplate as StoredTemplate,
  type TransactionTemplateRow,
} from '@/lib/transactionTemplates'

export type TransactionTemplate = StoredTemplate<Omit<TransactionFormValues, 'date'>>

function readLegacy(): string | null {
  try {
    return localStorage.getItem(LEGACY_TEMPLATES_KEY)
  } catch {
    return null
  }
}

/**
 * The signed-in user's saved templates (LED-257), stored in `transaction_templates`. The first load
 * after the move uploads this browser's old templates once, when the account has none, then drops
 * the old key. A failed read keeps what was loaded and says so; a failed upload keeps the key.
 */
export function useTransactionTemplates() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState<TransactionTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [failure, setFailure] = useState<DescribedError | null>(null)
  const loadedOnce = useRef(false)

  const read = useCallback(async (userId: string) => readWithPolicy((retry) => readAllPages<TransactionTemplateRow>((from, to) =>
    supabase
      .from('transaction_templates')
      .select('id, name, fields, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to)
      .retry(retry),
  ), { background: loadedOnce.current }), [])

  const refetch = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    let { rows, error } = await read(user.id)
    if (error) {
      setFailure(describeDataError(error, { action: 'load', entity: 'template' }))
      setLoading(false)
      return
    }

    let uploadFailure: DescribedError | null = null
    const legacy = readLegacy()
    if (legacy !== null) {
      const upload = legacyTemplateRows(legacy, user.id)
      if (shouldUploadLegacy(upload.length, rows.length)) {
        const { error: uploadError } = await supabase
          .from('transaction_templates')
          .upsert(upload, { onConflict: 'id', ignoreDuplicates: true })
        if (uploadError) {
          // The key stays, so the next load tries again; the list shows what the account holds.
          uploadFailure = describeDataError(uploadError, { action: 'save', entity: 'template' })
        } else {
          forgetLegacyTemplates()
          ;({ rows, error } = await read(user.id))
          if (error) {
            setFailure(describeDataError(error, { action: 'load', entity: 'template' }))
            setLoading(false)
            return
          }
        }
      } else {
        // Nothing readable, or the account already has its templates: the account is the record.
        forgetLegacyTemplates()
      }
    }

    loadedOnce.current = true
    setFailure(uploadFailure)
    setTemplates(parseTemplateRows(rows).templates as TransactionTemplate[])
    setLoading(false)
  }, [read, user])

  useEffect(() => {
    queueMicrotask(() => {
      void refetch()
    })
  }, [refetch])

  const addTemplate = useCallback(
    async (name: string, values: TransactionFormValues): Promise<MutationResult> => {
      if (!user) return { error: 'Not authenticated' }
      const { error } = await supabase
        .from('transaction_templates')
        .insert({ user_id: user.id, name: normalizeTemplateName(name), fields: serializeTemplateFields({ ...values }) })
      if (!error) await refetch()
      return toResult(error, { action: 'save', entity: 'template' })
    },
    [refetch, user],
  )

  const removeTemplate = useCallback(
    async (id: string): Promise<MutationResult> => {
      if (!user) return { error: 'Not authenticated' }
      const { error } = await supabase.from('transaction_templates').delete().eq('id', id).eq('user_id', user.id)
      if (!error) setTemplates((prev) => prev.filter((t) => t.id !== id))
      return toResult(error, { action: 'delete', entity: 'template' })
    },
    [user],
  )

  return {
    templates,
    loading,
    error: failure?.message ?? null,
    refetch,
    addTemplate,
    removeTemplate,
  }
}
