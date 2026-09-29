// One converted total for income/expense-shaped rows (LED-182). Pure: no `@/` alias, no hooks,
// so `node --test` can load it. Wraps `amountInCurrency`, the primitive `summarizeBalances`
// (accountsOverview.ts) already uses for account balances — this is the same idea for transactions.

import { amountInCurrency, type RateTable } from './exchangeRates.ts'

export interface RatedRow {
  amount: number
  currency: string
  exchange_rate?: number | null
}

export interface ConvertedTotal {
  total: number
  /** Currencies left out of `total` because no rate converts them (rule: rate of 1 is not a rate). */
  excludedCurrencies: string[]
}

/** Sums `rows` into `target`, converting each with `amountInCurrency`; a row with no rate is left out and named. */
export function sumConverted(rows: readonly RatedRow[], target: string, table: RateTable | null): ConvertedTotal {
  let total = 0
  const excluded = new Set<string>()
  for (const row of rows) {
    const converted = amountInCurrency({ amount: row.amount, currency: row.currency, exchange_rate: row.exchange_rate ?? null }, target, table)
    if (converted === null) excluded.add(row.currency)
    else total += converted
  }
  return { total, excludedCurrencies: [...excluded].sort() }
}
