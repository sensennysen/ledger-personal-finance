// The Home cash-flow forecast (LED-310). Pure: relative imports only, so `node --test` can load it.
// The starting balance is already in the base currency, so every recurring occurrence is converted
// into it with `amountInCurrency` before it is added. A currency with no rate is left out of the
// totals and named, never counted one to one (rule: a rate of 1 is not a rate).

import { amountInCurrency, type RateTable } from './exchangeRates.ts'
import { addRecurringInterval, computeNextDueDate, type RecurringInterval } from './recurringTransactions.ts'

export interface ForecastTransaction {
  type: string
  amount: number
  currency: string
  exchange_rate?: number | null
  date: string
  recurrence_interval: RecurringInterval
  recurrence_end_date?: string | null
}

export interface CashFlowForecastItem<T extends ForecastTransaction = ForecastTransaction> {
  tx: T
  occurrences: number
  /** occurrences * amount, in the transaction's own currency. */
  total: number
  /** `total` in the base currency, or null when no rate converts it. */
  converted: number | null
}

export interface CashFlowForecast<T extends ForecastTransaction = ForecastTransaction> {
  projectedIncome: number
  projectedExpenses: number
  projectedBalance: number
  /** Converted items first, largest first; unrated items last. */
  forecastItems: CashFlowForecastItem<T>[]
  /** Currencies left out of the totals because no rate converts them. */
  excludedCurrencies: string[]
}

function localMidnight(date: string) {
  return new Date(`${date}T00:00:00`)
}

export function buildCashFlowForecast<T extends ForecastTransaction>({
  series,
  cycleStart,
  cycleEnd,
  floor,
  currentBalance,
  baseCurrency,
  table,
}: {
  series: readonly T[]
  cycleStart: Date
  cycleEnd: Date
  floor: Date
  /** Already in `baseCurrency`. */
  currentBalance: number
  baseCurrency: string
  table: RateTable | null
}): CashFlowForecast<T> {
  let projectedIncome = 0
  let projectedExpenses = 0
  const excluded = new Set<string>()
  const forecastItems: CashFlowForecastItem<T>[] = []

  for (const tx of series) {
    let dateCursor = computeNextDueDate(tx.date, tx.recurrence_interval, floor)
    let occurrences = 0

    while (dateCursor <= cycleEnd) {
      if (dateCursor >= cycleStart) {
        if (!tx.recurrence_end_date || dateCursor <= localMidnight(tx.recurrence_end_date)) {
          occurrences++
        }
      }
      dateCursor = addRecurringInterval(dateCursor, tx.recurrence_interval)
    }

    if (occurrences === 0) continue

    const total = occurrences * tx.amount
    const converted = amountInCurrency({ amount: total, currency: tx.currency, exchange_rate: tx.exchange_rate ?? null }, baseCurrency, table)
    if (converted === null) excluded.add(tx.currency)
    else if (tx.type === 'income') projectedIncome += converted
    else projectedExpenses += converted

    forecastItems.push({ tx, occurrences, total, converted })
  }

  forecastItems.sort((a, b) => {
    if (a.converted === null || b.converted === null) {
      if (a.converted === b.converted) return b.total - a.total
      return a.converted === null ? 1 : -1
    }
    return b.converted - a.converted
  })

  return {
    projectedIncome,
    projectedExpenses,
    projectedBalance: currentBalance + projectedIncome - projectedExpenses,
    forecastItems,
    excludedCurrencies: [...excluded].sort(),
  }
}
