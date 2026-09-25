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

/** Percent of the limit above which a budget bar turns from fine to close. */
export const BUDGET_WARNING_THRESHOLD = 80

export type BudgetTone = 'income' | 'gold' | 'expense'

/** Fine while at or under the threshold, gold above it, expense when over budget. */
export function budgetTone(pct: number, over: boolean): BudgetTone {
  if (over || pct > 100) return 'expense'
  return pct > BUDGET_WARNING_THRESHOLD ? 'gold' : 'income'
}

/** Literal class strings so Tailwind's scanner keeps them. */
export const BUDGET_TONE_BAR_CLASS: Record<BudgetTone, string> = {
  income: '[&_[data-slot=progress-indicator]]:bg-income',
  gold: '[&_[data-slot=progress-indicator]]:bg-gold',
  expense: '[&_[data-slot=progress-indicator]]:bg-expense',
}
