import { nextRollover, canRollover, type DeficitBehaviour } from './budgetRollover.ts'
import { sumBudgetSpend, type BudgetSpendTx } from './budgetSpend.ts'
import { monthCycleRange, type DateRange as Range } from './cycleRange.ts'
import type { RateTable } from './exchangeRates.ts'
import { sumConverted } from './convertedTotals.ts'

const pad = (n: number) => String(n).padStart(2, '0')

export interface OverspendingBudget {
  id: string
  category_id: string
  amount: number
  currency: string
  period: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  start_date: string
  rollover_enabled: boolean
}

export interface OverspendingRow {
  budgetId: string
  categoryId: string
  currency: string
  /** A yearly row's spend is the year so far, not the selected cycle (LED-244). */
  period: OverspendingBudget['period']
  spent: number
  limit: number
  over: number
  /** Consecutive cycles over, including the selected one. Monthly budgets only; others are 1. */
  streak: number
  /** Overspend the 'carry' clamp did not absorb into the next cycle. Always 0 under 'reset'. */
  uncarried: number
}

export interface OverspendingResult {
  rows: OverspendingRow[]
  totals: { currency: string; over: number; uncarried: number }[]
  unrated: string[]
}

/**
 * The report's totals as one figure in `target` (LED-185): budgets in several currencies are no
 * longer printed as "A + B". A currency no rate converts is left out and named with the
 * currencies whose spending had no rate (rules/foreign-currency-rate-of-one-is-not-a-rate.md).
 */
export function convertOverspendingTotals(
  result: Pick<OverspendingResult, 'totals' | 'unrated'>,
  target: string,
  table: RateTable | null,
): { over: number; uncarried: number; excludedCurrencies: string[] } {
  const over = sumConverted(result.totals.map((t) => ({ amount: t.over, currency: t.currency, exchange_rate: null })), target, table)
  const uncarried = sumConverted(
    result.totals.map((t) => ({ amount: t.uncarried, currency: t.currency, exchange_rate: null })),
    target,
    table,
  )
  const excluded = new Set([...over.excludedCurrencies, ...uncarried.excludedCurrencies, ...result.unrated])
  return {
    over: Math.round(over.total * 100) / 100,
    uncarried: Math.round(uncarried.total * 100) / 100,
    excludedCurrencies: [...excluded].sort(),
  }
}

/** "YYYY-MM" of the first cycle a budget applies to, mirroring useBudgets' history walk. */
function firstCycleKey(startDate: string): string {
  return startDate.slice(0, 7)
}

interface Input {
  budgets: OverspendingBudget[]
  txs: BudgetSpendTx[]
  /** Selected cycle as "YYYY-MM". */
  month: string
  startDay: number
  behaviour: DeficitBehaviour
  /** Range of the selected cycle for weekly, quarterly and yearly budgets. */
  rangeFor: (period: OverspendingBudget['period']) => Range
  /** Exchange rates for spend in a currency other than the budget's (LED-136). */
  rates?: RateTable | null
}

/**
 * Budgets that went over in the selected cycle, derived from existing data.
 * Monthly budgets are walked cycle by cycle from their start so the effective
 * limit (base + rollover) and the consecutive-over count match what the
 * Budgets page shows; other periods only report the selected cycle.
 */
export function computeOverspending(input: Input): OverspendingResult {
  const { budgets, txs, month, startDay, behaviour, rangeFor, rates = null } = input
  const rows: OverspendingRow[] = []
  const unrated = new Set<string>()

  for (const b of budgets) {
    if (!canRollover(b.period)) {
      const { start, end } = rangeFor(b.period)
      const { spent, unrated: u } = sumBudgetSpend(txs, b, start, end, rates)
      u.forEach((c) => unrated.add(c))
      if (spent > b.amount) {
        rows.push({ budgetId: b.id, categoryId: b.category_id, currency: b.currency, period: b.period, spent, limit: b.amount, over: spent - b.amount, streak: 1, uncarried: 0 })
      }
      continue
    }

    const rolloverActive = b.rollover_enabled
    let rollover = 0
    let streak = 0
    let key = firstCycleKey(b.start_date)
    if (key > month) continue

    for (;;) {
      const { start, end } = monthCycleRange(key, startDay)
      const { spent, unrated: u } = sumBudgetSpend(txs, b, start, end, rates)
      const limit = Math.max(0, b.amount + (rolloverActive ? rollover : 0))
      const over = Math.max(0, spent - limit)
      streak = over > 0 ? streak + 1 : 0
      const unclamped = rollover + (b.amount - spent)

      if (key === month) {
        u.forEach((c) => unrated.add(c))
        if (over > 0) {
          const uncarried =
            rolloverActive && behaviour === 'carry' ? Math.max(0, -unclamped - b.amount) : 0
          rows.push({ budgetId: b.id, categoryId: b.category_id, currency: b.currency, period: b.period, spent, limit, over, streak, uncarried })
        }
        break
      }
      if (rolloverActive) rollover = nextRollover(rollover, b.amount - spent, b.amount, behaviour)
      const [y, m] = key.split('-').map(Number)
      const next = new Date(y, m, 1)
      key = `${next.getFullYear()}-${pad(next.getMonth() + 1)}`
    }
  }

  rows.sort((a, b) => b.over - a.over)

  const byCurrency = new Map<string, { currency: string; over: number; uncarried: number }>()
  for (const r of rows) {
    const t = byCurrency.get(r.currency) ?? { currency: r.currency, over: 0, uncarried: 0 }
    t.over += r.over
    t.uncarried += r.uncarried
    byCurrency.set(r.currency, t)
  }
  return { rows, totals: [...byCurrency.values()], unrated: [...unrated].sort() }
}

/**
 * What a budget's spent figure covers when it is not the cycle: a yearly budget adds up the whole
 * year, so wherever it sits beside cycle budgets it says so (LED-244, OD-13 item 12).
 */
export function spendWindowLabel(period: OverspendingBudget['period']): string | null {
  return period === 'yearly' ? 'year to date' : null
}

export function streakLabel(streak: number): string {
  return streak <= 1 ? '1st' : `${streak} in a row`
}

export function deficitSettingLabel(behaviour: DeficitBehaviour): string {
  return behaviour === 'reset' ? 'Start the next cycle fresh' : "Reduce next cycle's budget"
}

/** "YYYY-MM" one cycle before/after `month`. */
export function shiftMonthKey(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}
