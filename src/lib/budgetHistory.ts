import { nextRollover, type DeficitBehaviour } from './budgetRollover.ts'
import type { BudgetHistoryEntry } from '../types/index.ts'

/** One closed monthly period of a budget and what was spent in it. */
export interface PeriodSpend {
  period_start: string
  period_end: string
  spent: number
}

/**
 * The balance carried into the period after `periodSpends` (oldest first), for a
 * budget of `amount` per period. The list and the budget form both call this, so
 * the form's "Carried in" is the list's figure and moves with the amount and the
 * rollover switch being edited. Nothing carries when rollover is off.
 */
export function replayCarriedIn(
  periodSpends: number[],
  amount: number,
  rolloverActive: boolean,
  behaviour: DeficitBehaviour,
): number {
  if (!rolloverActive) return 0
  let carried = 0
  for (const spent of periodSpends) {
    carried = nextRollover(carried, amount - spent, amount, behaviour)
  }
  return carried
}

/** Per-period history rows plus the balance the current period opens with. */
export function buildBudgetHistory(
  periods: PeriodSpend[],
  amount: number,
  currency: string,
  rolloverActive: boolean,
  behaviour: DeficitBehaviour,
): { history: BudgetHistoryEntry[]; carriedIn: number } {
  const history: BudgetHistoryEntry[] = []
  let carried = 0
  for (const period of periods) {
    history.push({
      period_start: period.period_start,
      period_end: period.period_end,
      budget_amount: amount,
      spent_amount: period.spent,
      rollover_in: rolloverActive ? carried : 0,
      currency,
    })
    if (rolloverActive) carried = nextRollover(carried, amount - period.spent, amount, behaviour)
  }
  return { history, carriedIn: carried }
}
