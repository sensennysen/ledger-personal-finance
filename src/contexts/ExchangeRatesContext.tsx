import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useAccounts } from '@/hooks/useAccounts'
import { readCache, writeCache } from '@/lib/dataCache'
import { describeDataError, toResult, type DescribedError, type MutationResult } from '@/lib/dataErrors'
import {
  DEFAULT_REFRESH_FREQUENCY,
  feedUrl,
  isRefreshFrequency,
  isUsableRate,
  missingCurrencies,
  neededCurrencies,
  parseFeed,
  parseRateRow,
  rebaseOverrides,
  refreshDue,
  unansweredQuotes,
  type RateRow,
  type RateTable,
  type RefreshFrequency,
} from '@/lib/exchangeRates'
import { supabase } from '@/lib/supabase'
import { ExchangeRatesContext, type ExchangeRatesState } from './exchangeRatesState'

const FEED_TIMEOUT_MS = 10_000
const COLUMNS = 'base, rates, overrides, as_of, fetched_at'

/**
 * Exchange rates for the whole app (LED-136). One provider, so every screen reads the same table and
 * a refresh shows everywhere at once. It fetches from the feed on the schedule the user chose, at most
 * once per app load, and never replaces a rate the user typed.
 */
export function ExchangeRatesProvider({ children }: { children: ReactNode }) {
  const { user, profile, refreshProfile } = useAuth()
  const { accounts, loading: accountsLoading } = useAccounts()
  const [table, setTable] = useState<RateTable | null>(null)
  const [loading, setLoading] = useState(true)
  const [readFailure, setReadFailure] = useState<DescribedError | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshFailure, setRefreshFailure] = useState<DescribedError | null>(null)
  // The base the scheduled fetch last ran for: it runs once per app load, and again if the default currency changes.
  const attemptedFor = useRef<string | null>(null)

  const base = profile?.default_currency ?? 'USD'
  const frequency: RefreshFrequency = isRefreshFrequency(profile?.exchange_rate_refresh)
    ? profile.exchange_rate_refresh
    : DEFAULT_REFRESH_FREQUENCY
  const needed = useMemo(
    () => neededCurrencies(accounts.map((account) => account.currency), base),
    [accounts, base],
  )
  const missing = useMemo(() => missingCurrencies(table, needed, base), [table, needed, base])

  const cacheKey = user ? `${user.id}:exchange_rates` : null

  const reload = useCallback(async () => {
    if (!user || !cacheKey) {
      setLoading(false)
      return
    }
    const cached = readCache<RateRow>(cacheKey)
    if (cached) {
      setTable(parseRateRow(cached))
      setLoading(false)
    }
    if (!navigator.onLine) {
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('exchange_rates')
      .select(COLUMNS)
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) {
      setReadFailure(describeDataError(error, { action: 'load', entity: 'exchange rate' }))
      setLoading(false)
      return
    }
    setReadFailure(null)
    setTable(parseRateRow(data as RateRow | null))
    if (data) writeCache(cacheKey, data)
    setLoading(false)
  }, [cacheKey, user])

  useEffect(() => {
    queueMicrotask(() => {
      void reload()
    })
  }, [reload])

  /** Writes the row and, when it took, keeps state and cache in step with it. */
  const store = useCallback(
    async (userId: string, stored: RateRow): Promise<MutationResult> => {
      const { error } = await supabase.from('exchange_rates').upsert({ user_id: userId, ...stored }, { onConflict: 'user_id' })
      if (error) return toResult(error, { action: 'save', entity: 'exchange rate' })
      setTable(parseRateRow(stored))
      if (cacheKey) writeCache(cacheKey, stored)
      return { error: null }
    },
    [cacheKey],
  )

  const refresh = useCallback(async (): Promise<MutationResult> => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) {
      const failure = { message: "You're offline. Rates refresh when you are back online.", detail: null }
      setRefreshFailure(failure)
      return { error: failure.message }
    }
    setRefreshing(true)
    let rates: Record<string, number> = {}
    let asOf: string | null = null
    if (needed.length > 0) {
      try {
        const response = await fetch(feedUrl(base, needed), { signal: AbortSignal.timeout(FEED_TIMEOUT_MS) })
        if (!response.ok) {
          const failure = { message: "The rate feed isn't answering. Try again later.", detail: `HTTP ${response.status}` }
          setRefreshFailure(failure)
          setRefreshing(false)
          return { error: failure.message, errorDetail: failure.detail }
        }
        const parsed = parseFeed(await response.json(), base)
        if (!parsed.ok) {
          const failure = { message: parsed.reason, detail: null }
          setRefreshFailure(failure)
          setRefreshing(false)
          return { error: failure.message }
        }
        rates = parsed.rates
        asOf = parsed.asOf
      } catch (caught) {
        const detail = caught instanceof Error ? `${caught.name}: ${caught.message}` : String(caught)
        const failure = { message: "Couldn't reach the rate feed. Check your connection and try again.", detail }
        setRefreshFailure(failure)
        setRefreshing(false)
        return { error: failure.message, errorDetail: detail }
      }
    }
    // A change of default currency changes what "per 1 base" means for the rates the user typed.
    const overrides = table ? rebaseOverrides(table, base) : {}
    const result = await store(user.id, {
      base,
      rates,
      overrides,
      as_of: asOf,
      fetched_at: new Date().toISOString(),
    })
    setRefreshing(false)
    if (result.error) {
      setRefreshFailure({ message: result.error, detail: result.errorDetail ?? null })
      return result
    }
    const unanswered = unansweredQuotes(needed, rates).filter((code) => !isUsableRate(overrides[code]))
    if (unanswered.length > 0) {
      setRefreshFailure({
        message: `The rate feed has no rate for ${unanswered.join(', ')}. You can type one under Exchange rates in Settings.`,
        detail: null,
      })
    } else {
      setRefreshFailure(null)
    }
    return { error: null }
  }, [base, needed, store, table, user])

  // The scheduled fetch: once the stored rates, the profile and the accounts are all read, and only once per load.
  const refreshRef = useRef(refresh)
  useEffect(() => {
    refreshRef.current = refresh
  })
  useEffect(() => {
    if (!user || !profile || loading || accountsLoading) return
    if (!navigator.onLine) return
    const attemptedThisSession = attemptedFor.current === base
    if (!refreshDue({ frequency, table, base, needed, now: new Date(), attemptedThisSession })) return
    attemptedFor.current = base
    void refreshRef.current()
  }, [accountsLoading, base, frequency, loading, needed, profile, table, user])

  const setFrequency = useCallback(
    async (next: RefreshFrequency): Promise<MutationResult> => {
      if (!user) return { error: 'Not authenticated' }
      const { error } = await supabase.from('profiles').update({ exchange_rate_refresh: next }).eq('id', user.id)
      if (error) return toResult(error, { action: 'save', entity: 'setting' })
      await refreshProfile()
      return { error: null }
    },
    [refreshProfile, user],
  )

  const setOverride = useCallback(
    async (code: string, rate: number | null): Promise<MutationResult> => {
      if (!user) return { error: 'Not authenticated' }
      if (rate !== null && !isUsableRate(rate)) return { error: 'Enter a rate greater than zero.' }
      const current = table && table.base === base ? table : null
      const overrides = { ...(current?.overrides ?? (table ? rebaseOverrides(table, base) : {})) }
      if (rate === null) delete overrides[code]
      else overrides[code] = rate
      return store(user.id, {
        base,
        rates: current?.rates ?? {},
        overrides,
        as_of: current?.asOf ?? null,
        fetched_at: current?.fetchedAt ?? null,
      })
    },
    [base, store, table, user],
  )

  const value = useMemo<ExchangeRatesState>(
    () => ({
      table,
      loading,
      error: readFailure?.message ?? null,
      errorDetail: readFailure?.detail ?? null,
      refreshing,
      refreshError: refreshFailure?.message ?? null,
      refreshErrorDetail: refreshFailure?.detail ?? null,
      frequency,
      base,
      needed,
      missing,
      refresh,
      setFrequency,
      setOverride,
      reload,
    }),
    [base, frequency, loading, missing, needed, readFailure, refresh, refreshFailure, refreshing, reload, setFrequency, setOverride, table],
  )

  return <ExchangeRatesContext.Provider value={value}>{children}</ExchangeRatesContext.Provider>
}
