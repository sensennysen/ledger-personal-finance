import { createContext, useContext } from 'react'
import type { MutationResult } from '@/lib/dataErrors'
import type { RateTable, RefreshFrequency } from '@/lib/exchangeRates'

export interface ExchangeRatesState {
  /** The stored rates, or null before the first fetch (or while the read is failing). */
  table: RateTable | null
  /** The first read of the stored rates has not finished. */
  loading: boolean
  /** Reading the stored rates failed; `table` keeps whatever was loaded. */
  error: string | null
  errorDetail: string | null
  refreshing: boolean
  /** The last fetch from the feed failed. Cleared by the next one that works. */
  refreshError: string | null
  refreshErrorDetail: string | null
  frequency: RefreshFrequency
  /** The profile's default currency: the base every rate is quoted against. */
  base: string
  /** Currencies that need a rate: the accounts', not the base. */
  needed: string[]
  /** Needed currencies with no rate, fed or typed. Totals leave these out and say so. */
  missing: string[]
  refresh: () => Promise<MutationResult>
  setFrequency: (frequency: RefreshFrequency) => Promise<MutationResult>
  /** Sets (or, with null, clears) the rate the user types for a currency: units of it per 1 base. */
  setOverride: (code: string, rate: number | null) => Promise<MutationResult>
  reload: () => Promise<void>
}

export const ExchangeRatesContext = createContext<ExchangeRatesState | null>(null)

/**
 * The rates when the app shell provides them, else null. For hooks that also run outside the shell:
 * the Data deletion page's export card calls useBudgets on a public route, where fetching rates
 * would be a side effect of reading a legal page. Without rates a foreign-currency amount is left
 * out and named, as it is before any fetch.
 */
export function useOptionalExchangeRates(): ExchangeRatesState | null {
  return useContext(ExchangeRatesContext)
}

export function useExchangeRates(): ExchangeRatesState {
  const context = useContext(ExchangeRatesContext)
  if (!context) throw new Error('useExchangeRates requires ExchangeRatesProvider')
  return context
}
