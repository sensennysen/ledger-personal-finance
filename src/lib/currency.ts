/**
 * USD-anchored currency conversion.
 *
 * A `RateMap` holds the USD value of 1 unit of each ISO currency code, e.g.
 * `{ USD: 1, EUR: 1.08, PHP: 0.0175 }`. To convert between two non-USD
 * currencies we go A → USD → B, so changing the display currency never
 * invalidates stored rates.
 *
 * Rates are fetched from the Frankfurter API (ECB reference rates, no API key).
 * Currencies the ECB doesn't publish simply have no entry — conversions that
 * touch them return `null` and callers exclude those amounts from totals.
 */

export const RATES_BASE = 'USD'

export type RateMap = Record<string, number>

export interface ConvertibleAmount {
  amount: number
  currency: string
}

export interface ConvertedSum {
  /** Total in the target currency, excluding any amounts that couldn't be converted. */
  total: number
  /** How many input amounts had no usable rate and were left out of `total`. */
  excludedCount: number
  /** The distinct currency codes that were excluded, for a "add a rate" hint. */
  excludedCurrencies: string[]
}

function rateFor(code: string, rates: RateMap): number | null {
  if (code === RATES_BASE) return 1
  const r = rates[code]
  return typeof r === 'number' && Number.isFinite(r) && r > 0 ? r : null
}

/**
 * Convert `amount` from one currency to another.
 * Returns `null` when either side has no usable rate.
 */
export function convertAmount(
  amount: number,
  from: string,
  to: string,
  rates: RateMap,
): number | null {
  if (!Number.isFinite(amount)) return null
  if (from === to) return amount
  const fromRate = rateFor(from, rates)
  const toRate = rateFor(to, rates)
  if (fromRate === null || toRate === null) return null
  return (amount * fromRate) / toRate
}

/** True when every code can be converted into `to`. */
export function canConvertAll(codes: Iterable<string>, to: string, rates: RateMap): boolean {
  for (const code of codes) {
    if (convertAmount(1, code, to, rates) === null) return false
  }
  return true
}

/**
 * Sum a list of `{ amount, currency }` into `to`, dropping (and reporting)
 * any amounts whose currency can't be converted.
 */
export function sumConverted(
  items: ConvertibleAmount[],
  to: string,
  rates: RateMap,
): ConvertedSum {
  let total = 0
  let excludedCount = 0
  const excluded = new Set<string>()

  for (const { amount, currency } of items) {
    const converted = convertAmount(amount, currency, to, rates)
    if (converted === null) {
      excludedCount++
      excluded.add(currency)
    } else {
      total += converted
    }
  }

  return { total, excludedCount, excludedCurrencies: [...excluded] }
}

/** Turn Frankfurter's `{ EUR: 0.92 }` (units per 1 USD) into a USD-anchored map. */
export function frankfurterToRateMap(apiRates: Record<string, number>): RateMap {
  const map: RateMap = { [RATES_BASE]: 1 }
  for (const [code, perUsd] of Object.entries(apiRates)) {
    if (typeof perUsd === 'number' && Number.isFinite(perUsd) && perUsd > 0) {
      map[code] = 1 / perUsd
    }
  }
  return map
}

/** Merge auto-fetched rates with manual overrides (overrides win). */
export function effectiveRates(
  rates: RateMap | null | undefined,
  overrides: RateMap | null | undefined,
): RateMap {
  return { ...(rates ?? {}), ...(overrides ?? {}), [RATES_BASE]: 1 }
}
