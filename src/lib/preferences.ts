// Display and list preferences (LED-263). Pure: stored in `profiles.preferences`, which holds only
// the keys the user changed; every read merges these defaults over it and checks each value, so an
// unknown or broken value falls back to its default instead of reaching the formatters.

export type NumberLocale = 'en-US' | 'de-DE' | 'fr-FR' | 'ja-JP' | 'zh-CN'
export type DateFormat = 'MDY' | 'DMY' | 'YMD'

export interface Preferences {
  numberLocale: NumberLocale
  dateFormat: DateFormat
  largeTransactionThreshold: number
  creditCardNotificationsEnabled: boolean
  txView: 'grouped' | 'flat'
  txDensity: 'comfortable' | 'compact'
  accView: 'grouped' | 'flat'
}

export const DEFAULT_PREFERENCES: Preferences = {
  numberLocale: 'en-US',
  dateFormat: 'MDY',
  largeTransactionThreshold: 0,
  creditCardNotificationsEnabled: false,
  txView: 'grouped',
  txDensity: 'comfortable',
  accView: 'grouped',
}

/**
 * Where preferences lived before LED-263: one key for the whole browser, whoever signed in. It also
 * held `accGroupOrder`, which `profiles.account_group_order` already keeps, so the upload drops it.
 */
export const LEGACY_PREFERENCES_KEY = 'ledger-preferences'

const CHECKS: { [K in keyof Preferences]: (value: unknown) => boolean } = {
  numberLocale: (v) => ['en-US', 'de-DE', 'fr-FR', 'ja-JP', 'zh-CN'].includes(v as string),
  dateFormat: (v) => ['MDY', 'DMY', 'YMD'].includes(v as string),
  largeTransactionThreshold: (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0,
  creditCardNotificationsEnabled: (v) => typeof v === 'boolean',
  txView: (v) => v === 'grouped' || v === 'flat',
  txDensity: (v) => v === 'comfortable' || v === 'compact',
  accView: (v) => v === 'grouped' || v === 'flat',
}

const KEYS = Object.keys(CHECKS) as (keyof Preferences)[]

/** Only the known keys whose values pass their check. */
export function validPreferences(raw: unknown): Partial<Preferences> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  const value = raw as Record<string, unknown>
  const valid: Partial<Preferences> = {}
  for (const key of KEYS) {
    if (CHECKS[key](value[key])) (valid as Record<string, unknown>)[key] = value[key]
  }
  return valid
}

/** The preferences in effect: stored values over the defaults. */
export function parsePreferences(raw: unknown): Preferences {
  return { ...DEFAULT_PREFERENCES, ...validPreferences(raw) }
}

/**
 * What the browser's old key uploads: its readable values that differ from the defaults, or null when
 * there is nothing worth keeping (no key, unreadable JSON, or only defaults).
 */
export function legacyPreferencesUpload(raw: string | null): Partial<Preferences> | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  const valid = validPreferences(parsed)
  const changed: Partial<Preferences> = {}
  for (const key of KEYS) {
    if (key in valid && valid[key] !== DEFAULT_PREFERENCES[key]) (changed as Record<string, unknown>)[key] = valid[key]
  }
  return Object.keys(changed).length > 0 ? changed : null
}

/** Whether the account never wrote a preference, so a browser's old key may upload into it. */
export function preferencesNeverWritten(stored: unknown): boolean {
  return typeof stored !== 'object' || stored === null || Array.isArray(stored) || Object.keys(stored).length === 0
}

/** Removes the old browser-wide key: after an upload, and on sign-out. */
export function forgetLegacyPreferences(): void {
  try {
    localStorage.removeItem(LEGACY_PREFERENCES_KEY)
  } catch {
    /* storage unavailable: nothing to remove */
  }
}

export function readLegacyPreferences(): string | null {
  try {
    return localStorage.getItem(LEGACY_PREFERENCES_KEY)
  } catch {
    return null
  }
}
