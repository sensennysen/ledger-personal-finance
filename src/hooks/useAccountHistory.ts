import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { AccountHistoryState } from '@/lib/accountFormHints'
import { eitherAccountFilter } from '@/lib/accountFilter'

/**
 * Whether an account has history (a transaction from or to it, or a financed purchase), which locks
 * its currency (LED-316). The database refuses the change either way; this lets the form say so
 * before saving. Anything but a successful read with no history is treated as locked.
 */
export function useAccountHistory(accountId: string | undefined): AccountHistoryState {
  const [state, setState] = useState<AccountHistoryState>(accountId ? 'loading' : 'none')

  useEffect(() => {
    if (!accountId) return
    let cancelled = false
    void (async () => {
      const [txs, purchases] = await Promise.all([
        supabase.from('transactions').select('id', { count: 'exact', head: true })
          .or(eitherAccountFilter(accountId)),
        supabase.from('loan_purchases').select('id', { count: 'exact', head: true }).eq('account_id', accountId),
      ])
      if (cancelled) return
      if (txs.error || purchases.error) setState('unknown')
      else setState((txs.count ?? 0) + (purchases.count ?? 0) > 0 ? 'history' : 'none')
    })()
    return () => { cancelled = true }
  }, [accountId])

  return state
}
