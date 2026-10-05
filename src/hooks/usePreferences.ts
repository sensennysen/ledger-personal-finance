import { useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { parsePreferences, type Preferences } from '@/lib/preferences'

export type { DateFormat, NumberLocale, Preferences } from '@/lib/preferences'

/**
 * The signed-in user's preferences (LED-263), kept in `profiles.preferences` and read from the
 * profile, so every screen and device sees the same values. The cached profile is the local copy.
 */
export function usePreferences() {
  const { profile, setPreferences } = useAuth()
  const prefs = parsePreferences(profile?.preferences)

  const set = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPreferences({ [key]: value } as Partial<Preferences>)
  }, [setPreferences])

  const formatAmount = useCallback(
    (amount: number, currency: string) => {
      try {
        return new Intl.NumberFormat(prefs.numberLocale, {
          style: 'currency',
          currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(amount)
      } catch {
        return `${currency} ${amount.toFixed(2)}`
      }
    },
    [prefs.numberLocale],
  )

  const formatDatePref = useCallback(
    (dateStr: string) => {
      if (!dateStr) return ''
      const [year, month, day] = dateStr.split('-')
      if (!year || !month || !day) return dateStr
      switch (prefs.dateFormat) {
        case 'DMY':
          return `${day}/${month}/${year}`
        case 'YMD':
          return `${year}-${month}-${day}`
        case 'MDY':
        default:
          return `${month}/${day}/${year}`
      }
    },
    [prefs.dateFormat],
  )

  return {
    prefs,
    set,
    formatAmount,
    formatDatePref,
  }
}
