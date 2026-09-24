// Month jump (spec §7 V3): a list of cycle months, each with its net, that
// jumps straight to a month instead of stepping one cycle at a time.
import { monthCycleRange, type DateRange } from './cycleRange.ts'
import { signedAmount, type DayGroup } from './transactionWindow.ts'

interface MonthTx {
  date: string
  type: 'income' | 'expense' | 'transfer'
  amount: number
  currency: string
  exchange_rate?: number | null
  to_account_id?: string | null
}

export interface MonthNet {
  /** Cycle key, "YYYY-MM". */
  key: string
  count: number
  /** Net per currency, signed as the rows sign it. */
  net: Record<string, number>
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "2026-01", -1 -> "2025-12". */
export function shiftMonthKey(key: string, delta: number): string {
  const [year, month] = key.split('-').map(Number)
  const date = new Date(year, month - 1 + delta, 1)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

/** The cycle key a "YYYY-MM-DD" date falls in, using the same bounds as monthCycleRange. */
export function monthKeyOf(date: string, startDay: number): string {
  let key = date.slice(0, 7)
  // Starts from the calendar month and walks at most a step or two either way.
  for (let i = 0; i < 3; i++) {
    const range = monthCycleRange(key, startDay)
    if (date < range.start) key = shiftMonthKey(key, -1)
    else if (date > range.end) key = shiftMonthKey(key, 1)
    else break
  }
  return key
}

/**
 * Every cycle month from the newest (the current cycle, or later if something
 * is dated ahead) back to the oldest transaction, newest first. Empty months
 * are kept with a zero count so gaps stay visible.
 */
export function buildMonthNets(
  txs: MonthTx[],
  { startDay, currentKey, contextAccountId }: { startDay: number; currentKey: string; contextAccountId?: string },
): MonthNet[] {
  if (txs.length === 0) return []
  const byKey = new Map<string, MonthNet>()
  let oldest = currentKey
  let newest = currentKey
  for (const tx of txs) {
    const key = monthKeyOf(tx.date, startDay)
    if (key < oldest) oldest = key
    if (key > newest) newest = key
    let month = byKey.get(key)
    if (!month) {
      month = { key, count: 0, net: {} }
      byKey.set(key, month)
    }
    month.count += 1
    month.net[tx.currency] = (month.net[tx.currency] ?? 0) + signedAmount(tx, contextAccountId)
  }
  const months: MonthNet[] = []
  for (let key = newest; key >= oldest; key = shiftMonthKey(key, -1)) {
    months.push(byKey.get(key) ?? { key, count: 0, net: {} })
  }
  return months
}

/**
 * The first day group (in list order) inside `range`, and how many rows must
 * render to reach the end of it. Null when no group falls in the range.
 */
export function monthJumpTarget<T>(
  groups: DayGroup<T>[],
  range: DateRange,
): { date: string; rowsThrough: number } | null {
  let rows = 0
  for (const group of groups) {
    rows += group.items.length
    if (group.date >= range.start && group.date <= range.end) {
      return { date: group.date, rowsThrough: rows }
    }
  }
  return null
}
