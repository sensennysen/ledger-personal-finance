import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { readCache, writeCache } from '@/lib/dataCache'
import type { Budget, Columns } from '@/types'
import type { BudgetSpendTx } from '@/lib/budgetSpend'
import type { RateTable } from '@/lib/exchangeRates'
import { getCurrentCycleMonthKey } from '@/lib/utils'
import { getBudgetCycleRange } from '@/lib/budgetCycle'
import { sumBudgetSpend } from '@/lib/budgetSpend'
import { countedEnd } from '@/lib/countsYet'
import { useLocalDate } from '@/hooks/useLocalDate'
import { shiftMonthKey } from '@/lib/overspending'
import { readAllPages } from '@/lib/pagedRead'
import { readWithPolicy } from '@/lib/readRetry'
import { canRollover, type DeficitBehaviour } from '@/lib/budgetRollover'
import { buildBudgetHistory, type PeriodSpend } from '@/lib/budgetHistory'
import { useDeficitBehaviour } from '@/hooks/useDeficitBehaviour'
import { useOptionalExchangeRates } from '@/contexts/exchangeRatesState'
import { resolveRefresh } from '@/lib/loadState'
import { registerEntityListener } from '@/lib/cacheEvents'
import { describeDataError, toResult, type DescribedError, type MutationResult } from '@/lib/dataErrors'

function localDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Last cycle's expense rows, for "Add from last cycle"; `forKey` ties them to the cycle they were read for. */
export interface PreviousCycleSpend {
  forKey: string
  start: string
  end: string
  txs: BudgetSpendTx[]
}

export function useBudgets(
  cycle?: {
    selectedMonth: string
    startDay: number
  },
  deficitOverride?: DeficitBehaviour,
) {
  const { user } = useAuth()
  const profileDeficitBehaviour = useDeficitBehaviour()
  // Foreign-currency spend converts with these rates, so a read waits for them (LED-136).
  const rates = useOptionalExchangeRates()
  const rateTable = rates?.table ?? null
  const ratesLoading = rates?.loading ?? false
  // null = profile still loading; wait rather than computing rollover with a guessed setting.
  const deficitBehaviour = deficitOverride ?? profileDeficitBehaviour
  const selectedMonth = cycle?.selectedMonth
  const startDay = cycle?.startDay ?? 1
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailure, setLoadFailure] = useState<DescribedError | null>(null)
  // Cycle key the budgets on screen were read for; differs from the requested
  // key while a new cycle loads with the previous one still showing.
  const [dataKey, setDataKey] = useState<string | null>(null)
  const dataKeyRef = useRef<string | null>(null)
  const [previousCycleRead, setPreviousCycleRead] = useState<PreviousCycleSpend | null>(null)
  const today = useLocalDate()
  const requestId = useRef(0)
  const requestedKey = selectedMonth ? `${selectedMonth}:${startDay}` : 'current'

  const showBudgets = useCallback((next: Budget[], key: string | null) => {
    setBudgets(next)
    setDataKey(key)
    dataKeyRef.current = key
  }, [])

  const fetch = useCallback(async () => {
    const request = ++requestId.current
    setLoadFailure(null)
    if (!user) {
      setLoading(false)
      return
    }
    if (!deficitBehaviour || ratesLoading) {
      setLoading(true)
      return
    }
    const key = selectedMonth ? `${selectedMonth}:${startDay}` : 'current'
    const cacheKey = `${user.id}:budgets${selectedMonth ? `:${selectedMonth}:${startDay}` : ''}:${deficitBehaviour}`
    const cached = readCache<Budget[]>(cacheKey)
    if (cached) {
      showBudgets(cached, key)
      setLoading(false)
    } else {
      // Keep the previous cycle on screen while this one loads (LED-95).
      setLoading(true)
    }
    // A failed read for a new cycle must not leave the old cycle posing as it.
    const failNewCycle = (failure: DescribedError | null) => {
      if (dataKeyRef.current !== key) showBudgets([], null)
      setLoadFailure(failure)
      setLoading(false)
    }
    if (!navigator.onLine) {
      if (!cached) failNewCycle({ message: 'Budgets for this cycle are not cached. Reconnect to load them.', detail: null })
      else setLoading(false)
      return
    }

    // Fails fast on a first load, keeps the library retries when the cache is on screen (LED-242).
    const background = cached !== null
    const { data: budgetData, error: budgetError } = await readWithPolicy((retry) => supabase
      .from('budgets')
      .select('*, category:categories(id, name, color, icon, type)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .retry(retry)
      .overrideTypes<Budget[], { merge: false }>(), { background })

    if (request !== requestId.current) return
    if (budgetError) {
      failNewCycle(describeDataError(budgetError, { action: 'load' }))
      return
    }

    const budgets = budgetData

    // Fetch 13 months of expense transactions to cover history and rollover
    const now = selectedMonth
      ? new Date(
          `${selectedMonth}-${String(startDay).padStart(2, '0')}T00:00:00`,
        )
      : new Date()
    const fetchStart = localDateStr(
      new Date(now.getFullYear(), now.getMonth() - 13, 1),
    )
    const fetchEnd = localDateStr(
      new Date(now.getFullYear() + 1, 0, Math.max(1, startDay - 1)),
    )

    const { rows: spentData, error: spentError } = await readWithPolicy((retry) => readAllPages(
      (from, to) =>
        supabase
          .from('transactions')
          .select('category_id, amount, date, currency, exchange_rate')
          .eq('user_id', user.id)
          .eq('type', 'expense')
          .gte('date', fetchStart)
          .lte('date', fetchEnd)
          .order('date', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to)
          .retry(retry),
      undefined,
      () => request !== requestId.current,
    ), { background })

    if (request !== requestId.current) return
    if (spentError) {
      failNewCycle(describeDataError(spentError, { action: 'load' }))
      return
    }

    const allTx = spentData
    // Rows dated after today are scheduled: shown apart, counted from their date (LED-238).
    // `today` comes from useLocalDate, so a tab left open past midnight refetches on the new day.
    const currentMonthStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      startDay,
    )

    const enriched = budgets.map((b) => {
      const { start, end } = getBudgetCycleRange(
        b.period,
        selectedMonth ?? getCurrentCycleMonthKey(startDay),
        startDay,
      )

      const computeSpent = (rangeStart: string, rangeEnd: string) =>
        sumBudgetSpend(allTx, b, rangeStart, rangeEnd, rateTable)

      const counted = countedEnd(end, today)
      const { spent, unrated } = computeSpent(start, counted)
      // The day after `counted` to the period's end; nothing when the period is closed.
      const { spent: scheduled, unrated: scheduledUnrated } = counted < end
        ? sumBudgetSpend(allTx.filter((tx) => tx.date > counted), b, start, end, rateTable)
        : { spent: 0, unrated: [] as string[] }

      // Compute monthly rollover and history
      const rolloverActive = b.rollover_enabled && canRollover(b.period)
      const periods: PeriodSpend[] = []

      if (canRollover(b.period)) {
        const budgetStartDate = new Date(b.start_date + 'T00:00:00')
        let d = new Date(
          budgetStartDate.getFullYear(),
          budgetStartDate.getMonth(),
          startDay,
        )

        while (d < currentMonthStart) {
          const periodStart = localDateStr(d)
          const periodEnd = localDateStr(
            new Date(d.getFullYear(), d.getMonth() + 1, startDay - 1),
          )
          const { spent: periodSpent } = computeSpent(periodStart, periodEnd)
          periods.push({ period_start: periodStart, period_end: periodEnd, spent: periodSpent })
          d = new Date(d.getFullYear(), d.getMonth() + 1, startDay)
        }
      }

      const { history, carriedIn: rolloverAmount } = buildBudgetHistory(
        periods,
        b.amount,
        b.currency,
        rolloverActive,
        deficitBehaviour,
      )
      const recentHistory = history.slice(-6)
      const effectiveAmount = Math.max(
        0,
        b.amount + (rolloverActive ? rolloverAmount : 0),
      )

      return {
        ...b,
        spent,
        scheduled,
        unrated_currencies: [...new Set([...unrated, ...scheduledUnrated])].sort(),
        rollover_amount: rolloverAmount,
        effective_amount: effectiveAmount,
        history: recentHistory,
        // Every closed period's spend, so the form can replay Carried in for an edited amount.
        period_spends: periods.map((period) => period.spent),
      }
    })

    const previousRange = getBudgetCycleRange(
      'monthly',
      shiftMonthKey(selectedMonth ?? getCurrentCycleMonthKey(startDay), -1),
      startDay,
    )
    setPreviousCycleRead({
      forKey: key,
      start: previousRange.start,
      end: previousRange.end,
      txs: allTx.filter((tx) => tx.date >= previousRange.start && tx.date <= previousRange.end),
    })
    showBudgets(enriched, key)
    writeCache(cacheKey, enriched)
    setLoading(false)
  }, [user, selectedMonth, startDay, deficitBehaviour, showBudgets, rateTable, ratesLoading, today])

  useEffect(() => {
    queueMicrotask(() => {
      void fetch()
    })
  }, [fetch])

  // A transaction, category or queue drain elsewhere changes spend: re-read this cycle (LED-306).
  useEffect(() => registerEntityListener('budgets', () => { void fetch() }), [fetch])

  const createBudget = async (
    values: Omit<
      Budget,
      | 'id'
      | 'user_id'
      | 'created_at'
      | 'updated_at'
      | 'category'
      | 'spent'
      | 'scheduled'
      | 'unrated_currencies'
      | 'rollover_amount'
      | 'effective_amount'
      | 'history'
      | 'period_spends'
    >,
  ): Promise<MutationResult> => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) return { error: 'Connect to the internet to add a budget.' }
    const { error } = await supabase
      .from('budgets')
      .insert({ ...values, user_id: user.id })
    if (!error) await fetch()
    return toResult(error, { action: 'save', entity: 'budget' })
  }

  /** Inserts every budget in one call: all of them are created or none. */
  const createBudgets = async (
    rows: Omit<Budget, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'category' | 'spent' | 'scheduled' | 'unrated_currencies' | 'rollover_amount' | 'effective_amount' | 'history' | 'period_spends'>[],
  ): Promise<MutationResult> => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) return { error: 'Connect to the internet to add budgets.' }
    if (rows.length === 0) return { error: null }
    const { error } = await supabase
      .from('budgets')
      .insert(rows.map((row) => ({ ...row, user_id: user.id })))
    if (!error) await fetch()
    return toResult(error, { action: 'save', entity: 'budget' })
  }

  const updateBudget = async (id: string, values: Partial<Columns<'budgets', Budget>>): Promise<MutationResult> => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) return { error: 'Connect to the internet to edit this budget.' }
    const { error } = await supabase
      .from('budgets')
      .update(values)
      .eq('id', id)
      .eq('user_id', user.id)
    if (!error) await fetch()
    return toResult(error, { action: 'save', entity: 'budget' })
  }

  const deleteBudget = async (id: string): Promise<MutationResult> => {
    if (!user) return { error: 'Not authenticated' }
    if (!navigator.onLine) return { error: 'Connect to the internet to remove this budget.' }
    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (!error) await fetch()
    return toResult(error, { action: 'delete', entity: 'budget' })
  }

  const { refreshing } = resolveRefresh({
    loading,
    hasData: budgets.length > 0,
    dataKey,
    requestedKey,
  })

  const error = loadFailure?.message ?? null
  const errorDetail = loadFailure?.detail ?? null
  return {
    budgets,
    loading,
    /** Previous cycle's budgets are on screen while the selected one loads. */
    refreshing,
    error,
    errorDetail,
    refetch: fetch,
    /** Null until this cycle's read finishes, and when the budgets came from the offline cache. */
    previousCycle: previousCycleRead && previousCycleRead.forKey === requestedKey ? previousCycleRead : null,
    createBudget,
    createBudgets,
    updateBudget,
    deleteBudget,
  }
}

export interface BudgetExportRow extends Budget {
  spent: number
  unrated_currencies: string[]
}

/**
 * Every budget, active or not, with this cycle's converted spend, for the deletion-page export only
 * (LED-186). That page renders outside `ExchangeRatesProvider`, so `useBudgets` cannot convert there;
 * the caller passes the rates it read itself. No rollover or history is needed, so this is its own
 * simple read against `expenseTx` the caller already has loaded.
 */
export function useBudgetsForExport(expenseTx: BudgetSpendTx[], rateTable: RateTable | null) {
  const { user, profile } = useAuth()
  const startDay = profile?.month_start_day ?? 1
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailure, setLoadFailure] = useState<DescribedError | null>(null)
  const today = useLocalDate()
  const requestId = useRef(0)

  const fetch = useCallback(async () => {
    const request = ++requestId.current
    if (!user) {
      setLoading(false)
      return
    }
    setLoadFailure(null)
    setLoading(true)
    if (!navigator.onLine) {
      setLoadFailure({ message: 'Budgets are not cached for export. Reconnect to load them.', detail: null })
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('budgets')
      .select('*, category:categories(id, name, color, icon, type)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .overrideTypes<Budget[], { merge: false }>()
    if (request !== requestId.current) return
    if (error) {
      setLoadFailure(describeDataError(error, { action: 'load' }))
      setLoading(false)
      return
    }
    setBudgets(data)
    setLoading(false)
  }, [user])

  useEffect(() => {
    queueMicrotask(() => {
      void fetch()
    })
  }, [fetch])

  const monthKey = getCurrentCycleMonthKey(startDay)
  const enriched = useMemo<BudgetExportRow[]>(
    () =>
      budgets.map((b) => {
        const { start, end } = getBudgetCycleRange(b.period, monthKey, startDay)
        // Same "spent so far" as the Budgets page: rows after today are not counted yet (LED-238).
        const { spent, unrated } = sumBudgetSpend(expenseTx, b, start, countedEnd(end, today), rateTable)
        return { ...b, spent, unrated_currencies: unrated }
      }),
    [budgets, expenseTx, rateTable, monthKey, startDay, today]
  )

  return {
    budgets: enriched,
    loading,
    error: loadFailure?.message ?? null,
    errorDetail: loadFailure?.detail ?? null,
    refetch: fetch,
  }
}
