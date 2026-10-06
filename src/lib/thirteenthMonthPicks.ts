// 13th Month picks (LED-267). Pure: the income records picked as basic salary, per year, stored in
// `thirteenth_month_selections` (a year was saved) and `thirteenth_month_picks` (what was picked).

/** The per-user, per-year key prefix the picks lived under before LED-267. */
export function legacyPicksPrefix(userId: string): string {
  return `13th-month-selection:${userId}:`
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * One old key as an upload: its year and the valid transaction ids in it, or null when the key is
 * not this user's, its year is not a year, or its value is unreadable. An empty list is kept: it
 * was a saved "Clear".
 */
export function parseLegacyPicks(key: string, raw: string | null, userId: string): { year: number; ids: string[] } | null {
  const prefix = legacyPicksPrefix(userId)
  if (!key.startsWith(prefix) || raw === null) return null
  const year = Number(key.slice(prefix.length))
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!Array.isArray(parsed)) return null
  const ids = parsed.filter((id): id is string => typeof id === 'string' && UUID.test(id))
  return { year, ids: [...new Set(ids)] }
}

/** A year's saved picks from the two reads: null when the year was never saved (every record counts). */
export function picksFromRows(selectionSaved: boolean, rows: { transaction_id: string }[]): Set<string> | null {
  return selectionSaved ? new Set(rows.map((row) => row.transaction_id)) : null
}

/** The old keys of this user in this browser. */
export function legacyPicksKeys(userId: string): string[] {
  const prefix = legacyPicksPrefix(userId)
  const keys: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(prefix)) keys.push(key)
    }
  } catch {
    /* storage unavailable: nothing to move */
  }
  return keys
}

export function readLegacyPicks(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function forgetLegacyPicksKey(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* storage unavailable: nothing to remove */
  }
}
