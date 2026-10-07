import { supabase } from '@/lib/supabase'
import { readAllPages } from '@/lib/pagedRead'
import { useEntityQuery } from '@/hooks/useEntityQuery'
import type { CreditCardPayment } from '@/types'

const NO_PAYMENTS: CreditCardPayment[] = []

// Every credit card payment for the user, with no account filter. useCardPayment records and
// updates one payment as part of a transfer; this is a plain read for the data-export card
// (public page, LED-180) — needs only useAuth, no notification surface.
export function useCreditCardPayments() {
  // The export reads every payment, so page past PostgREST's 1,000-row cap (LED-308).
  const { data, loading, error, refetch } = useEntityQuery<CreditCardPayment[]>({
    entity: 'card-payments',
    cacheKey: (userId) => `${userId}:credit_card_payments`,
    read: async (userId, retry, signal) => {
      const { rows, error } = await readAllPages<CreditCardPayment>((from, to) => supabase
        .from('credit_card_payments')
        .select('*')
        .eq('user_id', userId)
        .order('payment_date', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to)
        .abortSignal(signal)
        .retry(retry), 1000, () => signal.aborted)
      return { data: rows, error }
    },
  })

  return { payments: data ?? NO_PAYMENTS, loading, error, refetch }
}
