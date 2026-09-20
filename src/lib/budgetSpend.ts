export interface BudgetSpendTx {
  category_id: string | null
  amount: number
  date: string
  currency: string
  exchange_rate: number | null
}

/**
 * Spend for one budget over [rangeStart, rangeEnd], in the budget's currency.
 * A transaction in another currency with no exchange rate cannot be converted:
 * it is excluded from the total and its currency is reported in `unrated`.
 */
export function sumBudgetSpend(
  txs: BudgetSpendTx[],
  budget: { category_id: string; currency: string },
  rangeStart: string,
  rangeEnd: string,
): { spent: number; unrated: string[] } {
  let spent = 0
  const unrated = new Set<string>()
  for (const tx of txs) {
    if (tx.category_id !== budget.category_id) continue
    if (tx.date < rangeStart || tx.date > rangeEnd) continue
    if (tx.currency === budget.currency) {
      spent += tx.amount
    } else if (tx.exchange_rate == null) {
      unrated.add(tx.currency)
    } else {
      spent += tx.amount * tx.exchange_rate
    }
  }
  return { spent, unrated: [...unrated].sort() }
}
