export interface BudgetUsage {
  /** The true share of the limit spent, rounded; null when a zero limit has spending. */
  usedPct: number | null
  /** The bar fill, held to 0–100 so an overspend fills it without overflowing. */
  barPct: number
  over: boolean
}

export function budgetUsage(spent: number, effective: number): BudgetUsage {
  const over = spent > effective
  if (effective <= 0) {
    return { usedPct: spent > 0 ? null : 0, barPct: spent > 0 ? 100 : 0, over }
  }
  const raw = (spent / effective) * 100
  return { usedPct: Math.round(raw), barPct: Math.min(Math.max(raw, 0), 100), over }
}
