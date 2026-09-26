// Exchange rates for totals and imports (LED-136). Pure: the context fetches and stores, this decides.
//
// One row per user in `exchange_rates`. `rates[C]` is how many units of C one unit of `base`
// buys (the feed's own direction: base USD, PHP 62.6 means 1 USD = 62.6 PHP). `overrides` uses
// the same units and wins over `rates`, so a rate the user typed is never replaced by a fetch.
// Nothing here guesses: a currency with no rate converts to null, and callers leave it out and say so.

export type RefreshFrequency = 'open' | 'daily' | 'weekly' | 'manual'

export const REFRESH_FREQUENCIES: { value: RefreshFrequency; label: string; hint: string }[] = [
  { value: 'open', label: 'Every time I open Ledger', hint: 'Fetches once each time the app loads.' },
  { value: 'daily', label: 'Once a day', hint: 'Fetches on the first visit of each day.' },
  { value: 'weekly', label: 'Once a week', hint: 'Fetches on the first visit after seven days.' },
  { value: 'manual', label: 'Only when I press Refresh', hint: 'Never fetches on its own.' },
]

export const DEFAULT_REFRESH_FREQUENCY: RefreshFrequency = 'daily'

export function isRefreshFrequency(value: unknown): value is RefreshFrequency {
  return REFRESH_FREQUENCIES.some((option) => option.value === value)
}

export interface RateTable {
  base: string
  rates: Record<string, number>
  overrides: Record<string, number>
  /** The date the feed says its rates are for. Weekends repeat the last business day. */
  asOf: string | null
  /** When Ledger last read the feed; null if it never has. */
  fetchedAt: string | null
}

/** A row as the database returns it, before its JSON is trusted. */
export interface RateRow {
  base: unknown
  rates: unknown
  overrides: unknown
  as_of: unknown
  fetched_at: unknown
}

export function isUsableRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/** Keeps the entries that are a currency code and a usable rate; anything else is dropped. */
function cleanRates(raw: unknown): Record<string, number> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  const out: Record<string, number> = {}
  for (const [code, value] of Object.entries(raw)) {
    if (/^[A-Z]{3}$/.test(code) && isUsableRate(value)) out[code] = value
  }
  return out
}

export function parseRateRow(row: RateRow | null | undefined): RateTable | null {
  if (!row || typeof row.base !== 'string' || !/^[A-Z]{3}$/.test(row.base)) return null
  return {
    base: row.base,
    rates: cleanRates(row.rates),
    overrides: cleanRates(row.overrides),
    asOf: typeof row.as_of === 'string' ? row.as_of : null,
    fetchedAt: typeof row.fetched_at === 'string' ? row.fetched_at : null,
  }
}

/** Every rate in force, the base at 1 and overrides over the feed. */
export function effectiveRates(table: RateTable): Record<string, number> {
  const merged: Record<string, number> = { ...table.rates, ...table.overrides }
  merged[table.base] = 1
  return merged
}

export type RateSource = 'same' | 'feed' | 'override'

export type RateLookup =
  | { kind: 'rate'; rate: number; source: RateSource }
  | { kind: 'none' }

/**
 * How many `to` one unit of `from` buys, going through the base. 'override' means either side
 * came from a rate the user typed; 'none' means a side has no rate.
 */
export function lookupRate(table: RateTable | null, from: string, to: string): RateLookup {
  if (from === to) return { kind: 'rate', rate: 1, source: 'same' }
  if (!table) return { kind: 'none' }
  const merged = effectiveRates(table)
  const perFrom = merged[from]
  const perTo = merged[to]
  if (!isUsableRate(perFrom) || !isUsableRate(perTo)) return { kind: 'none' }
  const typed = (code: string) => code !== table.base && isUsableRate(table.overrides[code])
  return { kind: 'rate', rate: perTo / perFrom, source: typed(from) || typed(to) ? 'override' : 'feed' }
}

/** The multiplier from one currency to another, or null when there is no rate. */
export function rateBetween(table: RateTable | null, from: string, to: string): number | null {
  const found = lookupRate(table, from, to)
  return found.kind === 'rate' ? found.rate : null
}

export type ConvertFn = (amount: number, from: string) => number | null

/** A converter into `target` for `amount`s in other currencies; null when a currency has no rate. */
export function converterTo(table: RateTable | null, target: string): ConvertFn {
  return (amount, from) => {
    const rate = rateBetween(table, from, target)
    return rate === null ? null : amount * rate
  }
}

interface RatedTransaction {
  amount: number
  currency: string
  exchange_rate: number | null
}

/**
 * A transaction's amount in `target`. Same currency as is. A rate recorded on the row (not null,
 * not the untouched default of 1) is honoured. Otherwise the table converts it. With neither the
 * amount is null: excluded from totals and named, never counted one to one.
 */
export function amountInCurrency(tx: RatedTransaction, target: string, table: RateTable | null): number | null {
  if (tx.currency === target) return tx.amount
  if (tx.exchange_rate != null && tx.exchange_rate !== 1 && isUsableRate(tx.exchange_rate)) {
    return tx.amount * tx.exchange_rate
  }
  const rate = rateBetween(table, tx.currency, target)
  return rate === null ? null : tx.amount * rate
}

/**
 * The user's typed rates in units of a new base. They are quoted per unit of the base, so a change
 * of default currency would make them wrong; each is re-expressed through the old table. One that
 * cannot be (the new base has no rate) is dropped rather than kept in the wrong units.
 */
export function rebaseOverrides(table: RateTable, newBase: string): Record<string, number> {
  if (table.base === newBase) return { ...table.overrides }
  const merged = effectiveRates(table)
  const perNewBase = merged[newBase]
  if (!isUsableRate(perNewBase)) return {}
  const out: Record<string, number> = {}
  for (const code of Object.keys(table.overrides)) {
    if (code === newBase) continue
    out[code] = merged[code] / perNewBase
  }
  return out
}

/** The currencies whose rates the feed is asked for: every account's, and the default's, but not the base. */
export function neededCurrencies(accountCurrencies: string[], base: string): string[] {
  return [...new Set(accountCurrencies.filter((code) => /^[A-Z]{3}$/.test(code) && code !== base))].sort()
}

/** Currencies with no rate at all (neither fed nor typed), so callers can name what stays out. */
export function missingCurrencies(table: RateTable | null, currencies: string[], base: string): string[] {
  return currencies.filter((code) => code !== base && lookupRate(table, code, base).kind === 'none').sort()
}

// ── When to fetch ───────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000

function localDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export interface RefreshInput {
  frequency: RefreshFrequency
  table: RateTable | null
  /** The profile's default currency; rates fetched against another base are out of date. */
  base: string
  /** Currencies that need a rate. */
  needed: string[]
  now: Date
  /** An automatic fetch already ran (or failed) since the app loaded. It does not repeat. */
  attemptedThisSession: boolean
}

/**
 * Whether Ledger should fetch on its own now. At most once per app load, so a failing feed is not
 * retried on every screen. 'manual' never fetches by itself. Otherwise a fetch is due when there is
 * no table yet, the base changed, a needed currency has no fed rate, or the chosen interval has passed.
 */
export function refreshDue(input: RefreshInput): boolean {
  const { frequency, table, base, needed, now, attemptedThisSession } = input
  if (frequency === 'manual' || attemptedThisSession) return false
  if (frequency === 'open') return true
  if (!table || !table.fetchedAt || table.base !== base) return true
  if (needed.some((code) => !isUsableRate(table.rates[code]))) return true
  const fetchedAt = new Date(table.fetchedAt)
  if (Number.isNaN(fetchedAt.getTime())) return true
  if (frequency === 'daily') return localDay(fetchedAt) !== localDay(now)
  return now.getTime() - fetchedAt.getTime() >= 7 * DAY_MS
}

// ── The feed ────────────────────────────────────────────────

export const FEED_URL = 'https://api.frankfurter.dev/v2/rates'

/** The feed request: rates of `quotes` against `base`. */
export function feedUrl(base: string, quotes: string[]): string {
  const params = new URLSearchParams({ base })
  if (quotes.length > 0) params.set('quotes', quotes.join(','))
  return `${FEED_URL}?${params.toString()}`
}

export type FeedResult =
  | { ok: true; rates: Record<string, number>; asOf: string | null }
  | { ok: false; reason: string }

/**
 * Reads the feed's answer: a list of { date, base, quote, rate }. Rows for another base or an
 * unusable rate are skipped; the answer is only good if it carries at least one usable rate.
 */
export function parseFeed(json: unknown, base: string): FeedResult {
  if (!Array.isArray(json)) return { ok: false, reason: 'The rate feed answered in a form Ledger does not understand.' }
  const rates: Record<string, number> = {}
  let asOf: string | null = null
  for (const item of json) {
    if (typeof item !== 'object' || item === null) continue
    const row = item as Record<string, unknown>
    if (row.base !== base || typeof row.quote !== 'string' || !/^[A-Z]{3}$/.test(row.quote)) continue
    if (!isUsableRate(row.rate)) continue
    rates[row.quote] = row.rate
    if (typeof row.date === 'string' && (asOf === null || row.date > asOf)) asOf = row.date
  }
  if (Object.keys(rates).length === 0) return { ok: false, reason: 'The rate feed had none of the currencies you use.' }
  return { ok: true, rates, asOf }
}

/** Quotes the feed did not return, so the user can be told which currencies still have no rate. */
export function unansweredQuotes(quotes: string[], rates: Record<string, number>): string[] {
  return quotes.filter((code) => !isUsableRate(rates[code]))
}

/** "Rates as of Sep 25" for a table, or null when there is no date to give. */
export function ratesAsOfLabel(table: RateTable | null): string | null {
  const day = table?.asOf
  if (!day) return null
  const [year, month, date] = day.split('-').map(Number)
  if (!year || !month || !date) return null
  return new Date(year, month - 1, date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** The most useful rate to show for a currency against the base: 1 base = N currency. */
export function displayRate(table: RateTable, code: string): { rate: number; source: 'feed' | 'override' } | null {
  if (isUsableRate(table.overrides[code])) return { rate: table.overrides[code], source: 'override' }
  if (isUsableRate(table.rates[code])) return { rate: table.rates[code], source: 'feed' }
  return null
}
