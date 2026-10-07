import { supabase } from '@/lib/supabase'
import { useEntityQuery } from '@/hooks/useEntityQuery'
import { parseRateRow, type RateRow } from '@/lib/exchangeRates'

const COLUMNS = 'base, rates, overrides, as_of, fetched_at'

// The user's exchange_rates row, read plainly with no feed fetch and no ExchangeRatesProvider:
// that provider needs useAccounts, which needs the notification surface, which is the LED-136
// trap on the public data-deletion page (knowledge/patterns/hooks-on-public-pages.md). Export
// card only (LED-180).
export function useExchangeRateRow() {
  const { data, loading, error, refetch } = useEntityQuery<RateRow | null>({
    entity: 'exchange-rates',
    offlineLabel: 'your exchange rates',
    cacheKey: (userId) => `${userId}:exchange_rates`,
    context: { action: 'load', entity: 'exchange rate' },
    read: (userId, retry, signal) => supabase
      .from('exchange_rates')
      .select(COLUMNS)
      .eq('user_id', userId)
      .abortSignal(signal)
      .retry(retry)
      .maybeSingle(),
  })

  return { table: data === undefined ? null : parseRateRow(data), loading, error, refetch }
}
