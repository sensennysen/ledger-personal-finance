export type DeficitBehaviour = 'carry' | 'reset'

/** Rollover history is computed per monthly cycle, so only monthly budgets can roll over. */
export function canRollover(period: string): boolean {
  return period === 'monthly'
}

/**
 * Next cycle's carried rollover after a period ends.
 * - reset: only surplus is carried; an overspend starts the next cycle fresh.
 * - carry: the deficit is carried, floored at -budgetAmount so the
 *   effective limit (budgetAmount + rollover) is never below zero.
 */
export function nextRollover(
  current: number,
  surplus: number,
  budgetAmount: number,
  behaviour: DeficitBehaviour,
): number {
  if (behaviour === 'reset') return current + Math.max(0, surplus)
  return Math.max(-budgetAmount, current + surplus)
}

export function isDeficitBehaviour(value: unknown): value is DeficitBehaviour {
  return value === 'carry' || value === 'reset'
}

/** The limit the next cycle opens at after spending `spent` against `budgetAmount`. */
export function deficitOutcome(
  budgetAmount: number,
  spent: number,
  behaviour: DeficitBehaviour,
): number {
  return budgetAmount + nextRollover(0, budgetAmount - spent, budgetAmount, behaviour)
}

export interface BudgetAllowance {
  base: number
  /** What rollover brings into this cycle; 0 when rollover is off. */
  carriedIn: number
  /** The limit this cycle actually runs on, never below zero. */
  effective: number
}

/** Base limit -> carried in -> effective, as useBudgets computes the effective limit. */
export function budgetAllowance(
  base: number,
  carriedIn: number,
  rolloverActive: boolean,
): BudgetAllowance {
  const carried = rolloverActive ? carriedIn : 0
  return { base, carriedIn: carried, effective: Math.max(0, base + carried) }
}

/**
 * The limit the next cycle opens at once this one closes with `spent`. Without
 * rollover nothing carries, so it opens at the base whatever the deficit setting.
 */
export function nextCycleOpensAt(
  base: number,
  carriedIn: number,
  spent: number,
  rolloverActive: boolean,
  behaviour: DeficitBehaviour,
): number {
  if (!rolloverActive) return base
  return budgetAllowance(base, nextRollover(carriedIn, base - spent, base, behaviour), true).effective
}
