import { useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { enqueue } from '@/lib/offlineQueue'
import { readCache, writeCache } from '@/lib/dataCache'
import type { Profile } from '@/types'

export function useMonthCycle() {
  const { user, profile, refreshProfile } = useAuth()

  // Optimistic local override; null = use profile value (synced or cached)
  const [override, setOverride] = useState<number | null>(null)

  const startDay = override ?? profile?.month_start_day ?? 1

  const setStartDay = useCallback(async (day: number): Promise<{ error: string | null }> => {
    const clamped = Math.min(28, Math.max(1, Math.round(day)))
    if (!user) return { error: 'Not authenticated' }

    // Optimistic update immediately for instant UI feedback
    setOverride(clamped)

    if (navigator.onLine) {
      const { error } = await supabase
        .from('profiles')
        .update({ month_start_day: clamped })
        .eq('id', user.id)
      if (!error) {
        await refreshProfile() // updates the cached profile too
        setOverride(null)      // clear override; profile now holds the real value
      } else {
        return { error: error.message }
      }
    } else {
      // Queue the DB update for when connectivity returns; stored before it is kept (LED-303)
      const { error } = await enqueue({
        table: 'profiles',
        operation: 'update',
        payload: { month_start_day: clamped },
        rowId: user.id,
        userId: user.id,
      })
      if (error) {
        setOverride(null)
        return { error }
      }
      // Patch the cached profile so it survives an offline reload
      const cacheKey = `${user.id}:profile`
      const cached = readCache<Profile>(cacheKey)
      if (cached) {
        writeCache(cacheKey, { ...cached, month_start_day: clamped })
      }
    }
    return { error: null }
  }, [user, refreshProfile])

  return { startDay, setStartDay }
}
