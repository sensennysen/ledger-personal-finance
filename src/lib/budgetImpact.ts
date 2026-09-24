export interface ImpactTx {
  type: string
  category_id: string | null
  amount: number
  date: string
  currency: string
  exchange_rate: number | null
}

export interface ImpactBudget {
  category_id: string
  currency: string
  amount: number
  spent?: number
  effective_amount?: number
}

export interface BudgetImpact {
  /** This entry, in the budget's currency. */
  entry: number
  /** Everything spent in the category this budget cycle, this entry included. */
  spent: number
  /** The cycle's allowance, rollover included. */
  allowance: number
  currency: string
}

/**
 * This entry's share of its category budget for the cycle it falls in — the
 * same currency conversion `sumBudgetSpend` uses. Null when there is nothing
 * honest to show: not an expense, no budget for the category, outside the
 * budget's range, an unconvertible currency, or no allowance.
 */
export function entryBudgetImpact(
  tx: ImpactTx,
  budget: ImpactBudget | null | undefined,
  range: { start: string; end: string },
): BudgetImpact | null {
  if (tx.type !== 'expense' || !tx.category_id || !budget) return null
  if (budget.category_id !== tx.category_id) return null
  if (tx.date < range.start || tx.date > range.end) return null
  let entry: number
  if (tx.currency === budget.currency) entry = tx.amount
  else if (tx.exchange_rate == null) return null
  else entry = tx.amount * tx.exchange_rate
  const allowance = budget.effective_amount ?? budget.amount
  if (!(allowance > 0)) return null
  return { entry, spent: Math.max(budget.spent ?? 0, entry), allowance, currency: budget.currency }
}
