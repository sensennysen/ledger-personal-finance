import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { readAllPages } from '@/lib/pagedRead'
import { sweepOrphanReceipts } from '@/lib/receiptCleanup'

// Users swept since this page loaded: once a session is enough for housekeeping.
const swept = new Set<string>()

/**
 * Removes receipt images no transaction points at any more (LED-324): left by a delete, a split's
 * removed original, or a receipt removed or replaced. Runs once per session, online, with nothing
 * in the offline queue, and keeps anything younger than a day (src/lib/receiptCleanup.ts). It is
 * housekeeping the user did not ask for, so a failure is logged and tried again next session.
 */
export function useReceiptSweep(): void {
  const { user } = useAuth()
  const { isOnline, pendingCount, flaggedCount } = useNetworkStatus()
  const userId = user?.id

  useEffect(() => {
    if (!userId || !isOnline || pendingCount > 0 || flaggedCount > 0 || swept.has(userId)) return
    swept.add(userId)
    let cancelled = false
    void (async () => {
      const { rows, error } = await readAllPages<{ receipt_url: string | null }>(
        (from, to) =>
          supabase
            .from('transactions')
            .select('receipt_url')
            .eq('user_id', userId)
            .not('receipt_url', 'is', null)
            .order('id')
            .range(from, to),
        1000,
        () => cancelled,
      )
      if (cancelled || error) {
        swept.delete(userId)
        if (error) console.warn('[receipts] sweep skipped:', error)
        return
      }
      try {
        const removed = await sweepOrphanReceipts(supabase.storage.from('receipts'), userId, rows.map((row) => row.receipt_url), Date.now())
        if (removed > 0) console.info(`[receipts] removed ${removed} unused receipt image${removed === 1 ? '' : 's'}`)
      } catch (err) {
        swept.delete(userId)
        console.warn('[receipts] sweep failed:', err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, isOnline, pendingCount, flaggedCount])
}
