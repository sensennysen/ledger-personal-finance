// Linked transactions summed in a savings goal's currency (LED-311). Pure: relative imports only.
// Income adds, an expense takes away. A currency with no rate is left out and named, never counted
// one to one (rule: a rate of 1 is not a rate).

import { amountInCurrency, type RateTable } from './exchangeRates.ts'

export interface GoalLinkedRow {
  type: string
  amount: number
  currency: string
  exchange_rate?: number | null
}

export interface GoalContributionTotal {
  total: number
  excludedCurrencies: string[]
}

export function goalContributionTotal(rows: readonly GoalLinkedRow[], goalCurrency: string, table: RateTable | null): GoalContributionTotal {
  let total = 0
  const excluded = new Set<string>()
  for (const row of rows) {
    const converted = amountInCurrency({ amount: row.amount, currency: row.currency, exchange_rate: row.exchange_rate ?? null }, goalCurrency, table)
    if (converted === null) excluded.add(row.currency)
    else total += row.type === 'expense' ? -converted : converted
  }
  return { total, excludedCurrencies: [...excluded].sort() }
}
