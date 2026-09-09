import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { readCache, writeCache } from '@/lib/dataCache'
import { CURRENCIES } from '@/types'
import {
  RATES_BASE,
  effectiveRates,
  frankfurterToRateMap,
  type RateMap,
} from '@/lib/currency'

// ECB reference rates via Frankfurter — no API key, permissive CORS (`*`).
const SYMBOLS = CURRENCIES.map((c) => c.code).filter((c) => c !== RATES_BASE)
const FRANKFURTER_URL =
  `https://api.frankfurter.dev/v1/latest?base=${RATES_BASE}&symbols=${SYMBOLS.join(',')}`

// Re-fetch when the stored rates are older than this.
const REFRESH_AFTER_MS = 12 * 60 * 60 * 1000
// Cache lives longer than the refresh window so offline sessions still have rates.
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000

interface CachedRates {
  base: string
  rates: RateMap
  overrides: RateMap
  asOf: string | null
  updatedAt: string | null
}

interface ExchangeRatesContextValue {
  /** Effective USD-anchored map: fetched rates + manual overrides + USD:1. */
  rates: RateMap
  /** Just the manual overrides, for the settings editor. */
  overrides: RateMap
  /** Date the auto-fetched rates are quoted for (YYYY-MM-DD). */
  asOf: string | null
  /** When the row was last written. */
  updatedAt: string | null
  loading: boolean
  error: string | null
  /** Force a fresh fetch now. */
  refresh: () => Promise<void>
  /** Set (or clear, with null) a manual override for one currency. */
  setOverride: (code: string, usdRate: number | null) => Promise<void>
}

const ExchangeRatesContext = createContext<ExchangeRatesContextValue | undefined>(undefined)

const EMPTY: CachedRates = {
  base: RATES_BASE,
  rates: {},
  overrides: {},
  asOf: null,
  updatedAt: null,
}

async function fetchFrankfurter(): Promise<{ rates: RateMap; asOf: string }> {
  const res = await fetch(FRANKFURTER_URL, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`Rate service responded ${res.status}`)
  const body = (await res.json()) as { date?: string; rates?: Record<string, number> }
  if (!body.rates || typeof body.rates !== 'object') {
    throw new Error('Rate service returned no rates')
  }
  return {
    rates: frankfurterToRateMap(body.rates),
    asOf: body.date ?? new Date().toISOString().slice(0, 10),
  }
}

export function ExchangeRatesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [state, setState] = useState<CachedRates>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef<Promise<void> | null>(null)

  const cacheKey = user ? `${user.id}:exchange_rates` : null

  const persist = useCallback(
    (next: CachedRates) => {
      setState(next)
      if (cacheKey) writeCache(cacheKey, next, CACHE_TTL_MS)
    },
    [cacheKey],
  )

  const runFetch = useCallback(
    async (current: CachedRates) => {
      if (!user || !navigator.onLine) return
      if (inFlight.current) return inFlight.current

      const task = (async () => {
        try {
          const { rates, asOf } = await fetchFrankfurter()
          const updatedAt = new Date().toISOString()
          const next: CachedRates = { ...current, base: RATES_BASE, rates, asOf, updatedAt }
          persist(next)
          setError(null)
          const { error: writeErr } = await supabase
            .from('exchange_rates')
            .upsert(
              { user_id: user.id, base: RATES_BASE, rates, as_of: asOf },
              { onConflict: 'user_id' },
            )
          if (writeErr) console.error('Failed to save exchange rates:', writeErr.message)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not update exchange rates')
        } finally {
          inFlight.current = null
        }
      })()

      inFlight.current = task
      return task
    },
    [user, persist],
  )

  // Load: cache → DB row → conditional fetch.
  useEffect(() => {
    let cancelled = false

    void (async () => {
      if (!user || !cacheKey) {
        setState(EMPTY)
        setLoading(false)
        return
      }

      setLoading(true)
      const cached = readCache<CachedRates>(cacheKey)
      if (cached && !cancelled) setState(cached)

      let current: CachedRates = cached ?? EMPTY

      if (navigator.onLine) {
        const { data, error: rowErr } = await supabase
          .from('exchange_rates')
          .select('base, rates, overrides, as_of, updated_at')
          .eq('user_id', user.id)
          .maybeSingle()

        if (cancelled) return
        if (rowErr) {
          setError(rowErr.message)
        } else if (data) {
          current = {
            base: data.base ?? RATES_BASE,
            rates: (data.rates as RateMap) ?? {},
            overrides: (data.overrides as RateMap) ?? {},
            asOf: data.as_of ?? null,
            updatedAt: data.updated_at ?? null,
          }
          persist(current)
        }
      }

      if (cancelled) return
      setLoading(false)

      const stale =
        !current.asOf ||
        !current.updatedAt ||
        Date.now() - Date.parse(current.updatedAt) > REFRESH_AFTER_MS
      if (stale) void runFetch(current)
    })()

    return () => {
      cancelled = true
    }
  }, [user, cacheKey, persist, runFetch])

  const refresh = useCallback(async () => {
    await runFetch(state)
  }, [runFetch, state])

  const setOverride = useCallback(
    async (code: string, usdRate: number | null) => {
      if (!user) return
      const nextOverrides: RateMap = { ...state.overrides }
      if (usdRate === null || !Number.isFinite(usdRate) || usdRate <= 0) {
        delete nextOverrides[code]
      } else {
        nextOverrides[code] = usdRate
      }
      const next = { ...state, overrides: nextOverrides }
      persist(next)
      const { error: writeErr } = await supabase
        .from('exchange_rates')
        .upsert(
          { user_id: user.id, base: RATES_BASE, overrides: nextOverrides },
          { onConflict: 'user_id' },
        )
      if (writeErr) {
        setError(writeErr.message)
      }
    },
    [user, state, persist],
  )

  const value = useMemo<ExchangeRatesContextValue>(
    () => ({
      rates: effectiveRates(state.rates, state.overrides),
      overrides: state.overrides,
      asOf: state.asOf,
      updatedAt: state.updatedAt,
      loading,
      error,
      refresh,
      setOverride,
    }),
    [state, loading, error, refresh, setOverride],
  )

  return (
    <ExchangeRatesContext.Provider value={value}>{children}</ExchangeRatesContext.Provider>
  )
}

export function useExchangeRates(): ExchangeRatesContextValue {
  const ctx = useContext(ExchangeRatesContext)
  if (!ctx) {
    // Safe fallback so a component rendered outside the provider (tests, stray
    // usage) still gets a USD-only map instead of crashing.
    return {
      rates: { [RATES_BASE]: 1 },
      overrides: {},
      asOf: null,
      updatedAt: null,
      loading: false,
      error: null,
      refresh: async () => {},
      setOverride: async () => {},
    }
  }
  return ctx
}
