export type DeficitBehaviour = 'carry' | 'reset'

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
