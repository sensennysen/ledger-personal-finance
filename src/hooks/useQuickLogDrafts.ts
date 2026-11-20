import { useAuth } from '@/contexts/AuthContext'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { invalidateAfterWrite, useEntityQuery } from '@/hooks/useEntityQuery'
import { toResult } from '@/lib/dataErrors'
import { listQueue } from '@/lib/offlineQueue'
import { readAllPages } from '@/lib/pagedRead'
import { supabase } from '@/lib/supabase'
import type { QuickLogResolution, QuickLogSource } from '@/lib/quickLog'
import type { Tables } from '@/types/database'

export type QuickLogDraft = Tables<'quick_log_drafts'>
export type QuickLogPartial = Extract<QuickLogResolution, { ready: false }>

export function useQuickLogDrafts(enabled = true) {
  const { user } = useAuth()
  const { isOnline } = useNetworkStatus()
  const query = useEntityQuery<QuickLogDraft[]>({
    entity: 'quick-log-drafts',
    cacheKey: (id) => `${id}:quick-log-drafts`,
    offlineLabel: 'your Quick Log drafts',
    enabled,
    read: async (id, retry, signal) => {
      const result = await readAllPages((from, to) => supabase.from('quick_log_drafts')
        .select('*').eq('user_id', id).order('created_at', { ascending: false }).order('id', { ascending: false })
        .range(from, to).retry(retry).abortSignal(signal), 1000, () => signal.aborted)
      return { data: result.rows, error: result.error }
    },
  })
  const queuedIds = new Set(enabled && user ? listQueue()
    .filter((item) => item.userId === user.id && item.table === 'transactions' && item.operation === 'insert')
    .map((item) => item.payload.id) : [])

  return {
    ...query,
    drafts: (query.data ?? []).filter((draft) => !queuedIds.has(draft.id)),
    isOnline,
  }
}

export async function saveQuickLogDraft(draft: QuickLogPartial, phrase: string, id: string, entrySource: QuickLogSource) {
  const { values } = draft
  const { error } = await supabase.from('quick_log_drafts').upsert({
    id, phrase, kind: draft.kind, reason: draft.reason, entry_source: entrySource,
    notes: values.notes ?? null, receipt_url: values.receipt_url ?? null,
    description: values.description || null, amount: values.amount || null, currency: values.currency ?? null,
    transaction_date: values.date || null, account_id: values.account_id || null,
    to_account_id: values.to_account_id ?? null, category_id: values.category_id ?? null,
    subcategory_id: values.subcategory_id ?? null, destination_amount: values.destination_amount ?? null,
    destination_currency: draft.destinationCurrency, transfer_fee: values.transfer_fee ?? null,
  }, { onConflict: 'id', ignoreDuplicates: true })
  if (!error) await invalidateAfterWrite('quick-log-drafts')
  return toResult(error, { action: 'save', entity: 'Quick Log draft' }).error
}

export async function discardQuickLogDraft(id: string) {
  const { error } = await supabase.from('quick_log_drafts').delete().eq('id', id)
  if (!error) await invalidateAfterWrite('quick-log-drafts')
  return toResult(error, { action: 'delete', entity: 'Quick Log draft' }).error
}
