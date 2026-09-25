import { budgetTone, budgetUsage } from './budgetUsage.ts'

// Pure figures for the Budgets page (LED-139): the four summary tiles, the
// "Needs attention" block and the % used ordering. No app imports, so node --test loads it.

export interface SummaryBudget {
  id: string
  name: string
  currency: string
  period: string
  amount: number
  spent?: number
  effective_amount?: number
  category?: { name: string; icon?: string | null } | null
}

const effectiveOf = (budget: SummaryBudget) => budget.effective_amount ?? budget.amount
const spentOf = (budget: SummaryBudget) => budget.spent ?? 0

export interface BudgetSummary {
  budgeted: number
  spent: number
  remaining: number
  /** Budgets counted in the tiles. */
  counted: number
  overCount: number
  overNames: string[]
  /** Not counted: another currency cannot be added to these totals. */
  otherCurrency: number
  /** Not counted: only monthly budgets belong to a cycle. */
  otherPeriod: number
}

/**
 * Totals for the cycle on screen. Only monthly budgets in `currency` are added
 * together; anything else is counted separately so the tiles can say what they leave out.
 */
export function summarizeBudgets(budgets: SummaryBudget[], currency: string): BudgetSummary {
  const summary: BudgetSummary = {
    budgeted: 0,
    spent: 0,
    remaining: 0,
    counted: 0,
    overCount: 0,
    overNames: [],
    otherCurrency: 0,
    otherPeriod: 0,
  }
  for (const budget of budgets) {
    if (budget.period !== 'monthly') {
      summary.otherPeriod += 1
      continue
    }
    if (budget.currency !== currency) {
      summary.otherCurrency += 1
      continue
    }
    const limit = effectiveOf(budget)
    const spent = spentOf(budget)
    summary.counted += 1
    summary.budgeted += limit
    summary.spent += spent
    if (spent > limit) {
      summary.overCount += 1
      summary.overNames.push(budget.category?.name ?? budget.name)
    }
  }
  summary.remaining = summary.budgeted - summary.spent
  return summary
}

/**
 * Most used first (4b: "Sorted by % used"). A zero limit with spending has no
 * finite percentage and goes to the top. Ties keep the incoming order.
 */
export function sortByUsage<T extends SummaryBudget>(budgets: T[]): T[] {
  const rank = (budget: T) => {
    const { usedPct } = budgetUsage(spentOf(budget), effectiveOf(budget))
    return usedPct === null ? Number.POSITIVE_INFINITY : usedPct
  }
  return budgets
    .map((budget, index) => ({ budget, index, rank: rank(budget) }))
    .sort((a, b) => b.rank - a.rank || a.index - b.index)
    .map((row) => row.budget)
}

export type AttentionItem =
  | { kind: 'over'; id: string; name: string; currency: string; overBy: number }
  | { kind: 'near'; id: string; name: string; currency: string; usedPct: number }

/**
 * Budgets worth a look: over budget (largest overspend first), then near the
 * limit (the gold band of budgetTone, most used first).
 */
export function needsAttention(budgets: SummaryBudget[]): AttentionItem[] {
  const over: Extract<AttentionItem, { kind: 'over' }>[] = []
  const near: Extract<AttentionItem, { kind: 'near' }>[] = []
  for (const budget of budgets) {
    const limit = effectiveOf(budget)
    const spent = spentOf(budget)
    const usage = budgetUsage(spent, limit)
    const name = budget.category?.name ?? budget.name
    if (usage.over) {
      over.push({ kind: 'over', id: budget.id, name, currency: budget.currency, overBy: spent - limit })
    } else if (budgetTone(usage.barPct, false) === 'gold' && usage.usedPct !== null) {
      near.push({ kind: 'near', id: budget.id, name, currency: budget.currency, usedPct: usage.usedPct })
    }
  }
  over.sort((a, b) => b.overBy - a.overBy)
  near.sort((a, b) => b.usedPct - a.usedPct)
  return [...over, ...near]
}

const dayNumber = (date: string) => {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number)
  return Date.UTC(year, month - 1, day) / 86_400_000
}

/** Days from `today` to the cycle's last day, or null when `today` is outside the cycle. */
export function cycleDaysLeft(start: string, end: string, today: string): number | null {
  if (today < start || today > end) return null
  return dayNumber(end) - dayNumber(today)
}
