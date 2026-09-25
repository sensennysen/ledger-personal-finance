import type { BudgetSpendTx } from './budgetSpend.ts'

// "Add from last cycle" (LED-139). A budget here is one recurring row, so there
// is no per-cycle copy to make; what last cycle can seed is a budget for a
// category that was spent in but has none.

export interface CategorySpend {
  category_id: string
  spent: number
  /** Currencies with no exchange rate, left out of `spent`. */
  unrated: string[]
}

/** Expense spend per category over [rangeStart, rangeEnd], converted into `currency`. */
export function spendByCategory(
  txs: BudgetSpendTx[],
  rangeStart: string,
  rangeEnd: string,
  currency: string,
): CategorySpend[] {
  const byCategory = new Map<string, { spent: number; unrated: Set<string> }>()
  for (const tx of txs) {
    if (!tx.category_id || tx.date < rangeStart || tx.date > rangeEnd) continue
    const entry = byCategory.get(tx.category_id) ?? { spent: 0, unrated: new Set<string>() }
    if (tx.currency === currency) entry.spent += tx.amount
    else if (tx.exchange_rate == null) entry.unrated.add(tx.currency)
    else entry.spent += tx.amount * tx.exchange_rate
    byCategory.set(tx.category_id, entry)
  }
  return [...byCategory].map(([category_id, entry]) => ({
    category_id,
    spent: entry.spent,
    unrated: [...entry.unrated].sort(),
  }))
}

export interface SuggestedBudget {
  category_id: string
  amount: number
}

/**
 * Categories spent in last cycle with no budget yet, biggest spend first. The
 * amount is last cycle's spend rounded up to a whole unit.
 */
export function lastCycleCandidates(
  spend: CategorySpend[],
  budgetedCategoryIds: Iterable<string>,
): SuggestedBudget[] {
  const budgeted = new Set(budgetedCategoryIds)
  return spend
    .filter((row) => row.spent > 0 && !budgeted.has(row.category_id))
    .sort((a, b) => b.spent - a.spent)
    .map((row) => ({ category_id: row.category_id, amount: Math.ceil(row.spent) }))
}
