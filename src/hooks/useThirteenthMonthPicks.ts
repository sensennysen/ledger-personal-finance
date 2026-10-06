import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { readAllPages } from '@/lib/pagedRead'
import { readWithPolicy } from '@/lib/readRetry'
import { describeDataError, toResult, type DescribedError, type MutationResult } from '@/lib/dataErrors'
import { forgetLegacyPicksKey, legacyPicksKeys, parseLegacyPicks, picksFromRows, readLegacyPicks } from '@/lib/thirteenthMonthPicks'

interface YearPicks {
  /** null: never saved, so every record counts. */
  picks: Set<string> | null
  loading: boolean
  error: DescribedError | null
}

const NOT_LOADED: YearPicks = { picks: null, loading: true, error: null }

/**
 * The income records picked for each year's 13th Month estimate (LED-267), kept in the account so
 * every device shows the same picks. The first read moves this browser's old picks in, each year only
 * if the account has none for it. A failed read says so and is never shown as "every record counts".
 */
export function useThirteenthMonthPicks(year: number) {
  const { user } = useAuth()
  const [byYear, setByYear] = useState<Map<number, YearPicks>>(new Map())
  const movedFor = useRef<string | null>(null)
  const byYearRef = useRef(byYear)
  useEffect(() => {
    byYearRef.current = byYear
  }, [byYear])

  const load = useCallback(async (forYear: number) => {
    if (!user) return
    // With this year's picks on screen, a reread is a background read (readRetry).
    const background = byYearRef.current.get(forYear)?.loading === false
    setByYear((prev) => new Map(prev).set(forYear, { ...(prev.get(forYear) ?? NOT_LOADED), loading: true }))

    let moveFailure: DescribedError | null = null
    if (movedFor.current !== user.id) {
      for (const key of legacyPicksKeys(user.id)) {
        const legacy = parseLegacyPicks(key, readLegacyPicks(key), user.id)
        if (legacy) {
          const { error } = await supabase.rpc('set_thirteenth_month_picks', {
            p_year: legacy.year,
            p_ids: legacy.ids,
            p_only_if_absent: true,
          })
          if (error) {
            // The key stays, so the next visit tries again.
            moveFailure = describeDataError(error, { action: 'save', entity: 'pick' })
            continue
          }
        }
        forgetLegacyPicksKey(key)
      }
      if (!moveFailure) movedFor.current = user.id
    }

    const [selection, picks] = await Promise.all([
      readWithPolicy((retry) => supabase
        .from('thirteenth_month_selections')
        .select('year')
        .eq('user_id', user.id)
        .eq('year', forYear)
        .retry(retry), { background }),
      readWithPolicy((retry) => readAllPages<{ transaction_id: string }>((from, to) => supabase
        .from('thirteenth_month_picks')
        .select('transaction_id')
        .eq('user_id', user.id)
        .eq('year', forYear)
        .order('transaction_id')
        .range(from, to)
        .retry(retry)), { background }),
    ])
    const readError = selection.error ?? picks.error
    setByYear((prev) => {
      const next = new Map(prev)
      if (readError) {
        const kept = prev.get(forYear)
        next.set(forYear, {
          picks: kept?.picks ?? null,
          loading: false,
          error: describeDataError(readError, { action: 'load', entity: 'pick' }),
        })
      } else {
        next.set(forYear, {
          picks: picksFromRows((selection.data ?? []).length > 0, picks.rows),
          loading: false,
          error: moveFailure,
        })
      }
      return next
    })
  }, [user])

  useEffect(() => {
    queueMicrotask(() => {
      void load(year)
    })
  }, [load, year])

  /** The year's state; a year not read yet reads as loading. */
  const forYear = useCallback((y: number): YearPicks => byYear.get(y) ?? NOT_LOADED, [byYear])

  /** Replaces a year's picks. Shown at once; a failed save puts the previous picks back. */
  const save = useCallback(async (y: number, ids: Set<string>): Promise<MutationResult> => {
    if (!user) return { error: 'Not authenticated' }
    const previous = byYear.get(y)
    setByYear((prev) => new Map(prev).set(y, { picks: ids, loading: false, error: null }))
    const { error } = await supabase.rpc('set_thirteenth_month_picks', { p_year: y, p_ids: [...ids] })
    if (error && previous) setByYear((prev) => new Map(prev).set(y, previous))
    return toResult(error, { action: 'save', entity: 'pick' })
  }, [byYear, user])

  return { forYear, save, reload: load }
}
