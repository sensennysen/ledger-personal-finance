// Settings changed on this device that the account has not stored yet (LED-278). Pure: AuthContext
// keeps this in memory and in the data copy (`ledger_cache:<user>:pending-settings`), so a reload
// while offline keeps the change and sends it when the app is back online. Sign-out removes it with
// the rest of the data copy (LED-268).
//
// Each entry remembers the account's value when the change was made (`base`). A pending value is
// sent only while the account still holds that base: if another device changed the same setting in
// the meantime, the account's newer value wins and the pending one is dropped.

export type PendingGroup = 'columns' | 'preferences'

export interface PendingEntry {
  value: unknown
  base: unknown
}

export type PendingSettings = Record<PendingGroup, Record<string, PendingEntry>>

export const EMPTY_PENDING: PendingSettings = { columns: {}, preferences: {} }

/** The data-copy key, read and written through readCache / writeCache. */
export const pendingSettingsKey = (userId: string) => `${userId}:pending-settings`

const GROUPS: PendingGroup[] = ['columns', 'preferences']

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Values compare by their JSON; a missing value and null are the same. */
export function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

/** A stored copy, or EMPTY_PENDING when it is missing or broken. */
export function parsePendingSettings(raw: unknown): PendingSettings {
  if (!isObject(raw)) return EMPTY_PENDING
  const parsed: PendingSettings = { columns: {}, preferences: {} }
  for (const group of GROUPS) {
    const entries = raw[group]
    if (!isObject(entries)) continue
    for (const [key, entry] of Object.entries(entries)) {
      if (isObject(entry) && 'value' in entry) parsed[group][key] = { value: entry.value, base: entry.base ?? null }
    }
  }
  return parsed
}

export function isPendingEmpty(pending: PendingSettings): boolean {
  return GROUPS.every((group) => Object.keys(pending[group]).length === 0)
}

/** The values waiting in one group, as a patch. */
export function pendingValues(pending: PendingSettings, group: PendingGroup): Record<string, unknown> {
  return Object.fromEntries(Object.entries(pending[group]).map(([key, entry]) => [key, entry.value]))
}

/**
 * Adds a change. `account` holds the values the change replaces; a key already waiting keeps its
 * first base, since the account has still not stored anything newer from this device.
 */
export function recordPending(
  pending: PendingSettings,
  group: PendingGroup,
  patch: Record<string, unknown>,
  account: Record<string, unknown> | null | undefined,
): PendingSettings {
  const entries = { ...pending[group] }
  for (const [key, value] of Object.entries(patch)) {
    const base = key in entries ? entries[key].base : (account?.[key] ?? null)
    entries[key] = { value, base }
  }
  return { ...pending, [group]: entries }
}

/** Removes what the account stored. A key changed again while it was being sent keeps waiting. */
export function withoutSent(pending: PendingSettings, group: PendingGroup, sent: Record<string, PendingEntry>): PendingSettings {
  const entries = { ...pending[group] }
  for (const [key, entry] of Object.entries(sent)) {
    if (key in entries && sameValue(entries[key].value, entry.value)) delete entries[key]
  }
  return { ...pending, [group]: entries }
}

/**
 * Checks the waiting changes against the account just read. A key is dropped when the account
 * already holds its value (sent before a reload), or when the account moved away from its base
 * (another device saved a newer value, which wins).
 */
export function dropStale(
  pending: PendingSettings,
  account: { preferences?: Record<string, unknown> | null } & Record<string, unknown>,
): PendingSettings {
  const current: Record<PendingGroup, Record<string, unknown>> = {
    columns: account,
    preferences: isObject(account.preferences) ? account.preferences : {},
  }
  const next: PendingSettings = { columns: {}, preferences: {} }
  for (const group of GROUPS) {
    for (const [key, entry] of Object.entries(pending[group])) {
      const stored = current[group][key]
      if (sameValue(stored, entry.value) || !sameValue(stored, entry.base)) continue
      next[group][key] = entry
    }
  }
  return next
}
