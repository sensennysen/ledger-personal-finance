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
