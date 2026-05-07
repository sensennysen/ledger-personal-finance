import { useState, useCallback } from 'react'
import type { AccountType } from '@/types'

export type NumberLocale = 'en-US' | 'de-DE' | 'fr-FR' | 'ja-JP' | 'zh-CN'
export type DateFormat = 'MDY' | 'DMY' | 'YMD'

export interface Preferences {
  numberLocale: NumberLocale
  dateFormat: DateFormat
  largeTransactionThreshold: number
  txView: 'grouped' | 'flat'
  accView: 'grouped' | 'flat'
  accGroupOrder: AccountType[]
}

const STORAGE_KEY = 'ledger-preferences'

const DEFAULTS: Preferences = {
  numberLocale: 'en-US',
  dateFormat: 'MDY',
  largeTransactionThreshold: 0,
  txView: 'grouped',
  accView: 'grouped',
  accGroupOrder: [],
}

function load(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return DEFAULTS
  }
}

function save(prefs: Preferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {}
}

let _prefs: Preferences = load()
const _listeners: Set<() => void> = new Set()

function notify() {
  _listeners.forEach((fn) => fn())
}

export function usePreferences() {
  const [, forceRender] = useState(0)

  const subscribe = useCallback((fn: () => void) => {
    _listeners.add(fn)
    return () => _listeners.delete(fn)
  }, [])

  // Subscribe on mount
  useState(() => {
    const unsub = subscribe(() => forceRender((n) => n + 1))
    return unsub
  })

  const set = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    _prefs = { ..._prefs, [key]: value }
    save(_prefs)
    notify()
  }, [])

  const formatAmount = useCallback(
    (amount: number, currency: string) => {
      try {
        return new Intl.NumberFormat(_prefs.numberLocale, {
          style: 'currency',
          currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(amount)
      } catch {
        return `${currency} ${amount.toFixed(2)}`
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [_prefs.numberLocale],
  )

  const formatDatePref = useCallback(
    (dateStr: string) => {
      if (!dateStr) return ''
      const [year, month, day] = dateStr.split('-')
      if (!year || !month || !day) return dateStr
      switch (_prefs.dateFormat) {
        case 'DMY':
          return `${day}/${month}/${year}`
        case 'YMD':
          return `${year}-${month}-${day}`
        case 'MDY':
        default:
          return `${month}/${day}/${year}`
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [_prefs.dateFormat],
  )

  return {
    prefs: _prefs,
    set,
    formatAmount,
    formatDatePref,
  }
}
