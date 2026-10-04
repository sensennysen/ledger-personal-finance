import { amountInCurrency, type RateTable } from './exchangeRates.ts'

export interface BudgetSpendTx {
  category_id: string | null
  amount: number
  date: string
  currency: string
  exchange_rate: number | null
}

/**
 * Spend for one budget over [rangeStart, rangeEnd], in the budget's currency.
 * A transaction in another currency is converted at the rate recorded on it, else at
 * the exchange-rate table's rate (LED-136). With neither it cannot be converted:
 * it is excluded from the total and its currency is reported in `unrated`.
 */
export function sumBudgetSpend(
  txs: BudgetSpendTx[],
  budget: { category_id: string; currency: string },
  rangeStart: string,
  rangeEnd: string,
  rates: RateTable | null = null,
): { spent: number; unrated: string[] } {
  let spent = 0
  const unrated = new Set<string>()
  for (const tx of txs) {
    if (tx.category_id !== budget.category_id) continue
    if (tx.date < rangeStart || tx.date > rangeEnd) continue
    const converted = amountInCurrency(tx, budget.currency, rates)
    if (converted === null) unrated.add(tx.currency)
    else spent += converted
  }
  return { spent, unrated: [...unrated].sort() }
}
