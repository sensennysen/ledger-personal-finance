// Transaction lists render a window of rows that grows on scroll (spec §7 V1):
// 60 rows per step on desktop, 30 on mobile. Day headers always describe the
// whole day, even when only part of it is inside the window.
export const WINDOW_STEP = { desktop: 60, mobile: 30 } as const

interface WindowedTx {
  date: string
  type: 'income' | 'expense' | 'transfer'
  amount: number
  currency: string
  exchange_rate?: number | null
  to_account_id?: string | null
}

export interface DayGroup<T> {
  date: string
  items: T[]
  count: number
  /** Net per currency; the app has no conversion, so currencies never mix. */
  net: Record<string, number>
}

/**
 * Signed amount as the row displays it. Without an account context a transfer
 * moves money between the user's own accounts and nets to zero. Inside an
 * account, money arriving (transfer or loan repayment into it) is positive and
 * carried at the exchange rate, matching TransactionRow.
 */
export function signedAmount(tx: WindowedTx, contextAccountId?: string): number {
  if (contextAccountId !== undefined) {
    const incoming = (tx.type === 'transfer' || tx.type === 'expense') && tx.to_account_id === contextAccountId
    if (incoming) return tx.amount * (tx.exchange_rate ?? 1)
    if (tx.type === 'income') return tx.amount
    return -tx.amount
  }
  if (tx.type === 'income') return tx.amount
  if (tx.type === 'expense') return -tx.amount
  return 0
}

/** Result-bar sort (spec §7 V2). Date only, so day groups stay intact either way. */
export type TxSort = 'newest' | 'oldest'

function compareDates(a: string, b: string, sort: TxSort): number {
  return sort === 'newest' ? b.localeCompare(a) : a.localeCompare(b)
}

/** Sorted copy by date; rows on the same day keep their incoming order. */
export function sortByDate<T extends { date: string }>(txs: T[], sort: TxSort): T[] {
  return [...txs].sort((a, b) => compareDates(a.date, b.date, sort))
}

/** Sum of the signed amounts per currency, as the rows and day headers sign them. */
export function sumByCurrency(txs: WindowedTx[], contextAccountId?: string): Record<string, number> {
  const sum: Record<string, number> = {}
  for (const tx of txs) {
    sum[tx.currency] = (sum[tx.currency] ?? 0) + signedAmount(tx, contextAccountId)
  }
  return sum
}

/** Earliest and latest date in the list, or null when it is empty. */
export function dateSpan(txs: { date: string }[]): { start: string; end: string } | null {
  if (txs.length === 0) return null
  let start = txs[0].date
  let end = txs[0].date
  for (const tx of txs) {
    if (tx.date < start) start = tx.date
    if (tx.date > end) end = tx.date
  }
  return { start, end }
}

/** Groups by day in `sort` order, keeping the incoming order within a day. */
export function groupByDay<T extends WindowedTx>(
  txs: T[],
  contextAccountId?: string,
  sort: TxSort = 'newest',
): DayGroup<T>[] {
  const byDate = new Map<string, DayGroup<T>>()
  for (const tx of txs) {
    let group = byDate.get(tx.date)
    if (!group) {
      group = { date: tx.date, items: [], count: 0, net: {} }
      byDate.set(tx.date, group)
    }
    group.items.push(tx)
    group.count += 1
    // Keyed by tx.currency, the currency TransactionRow labels the amount with.
    group.net[tx.currency] = (group.net[tx.currency] ?? 0) + signedAmount(tx, contextAccountId)
  }
  return [...byDate.values()].sort((a, b) => compareDates(a.date, b.date, sort))
}

/** Cuts groups so exactly `rowCount` rows render; partial days keep their full count and net. */
export function sliceGroups<T>(groups: DayGroup<T>[], rowCount: number): DayGroup<T>[] {
  const out: DayGroup<T>[] = []
  let remaining = rowCount
  for (const group of groups) {
    if (remaining <= 0) break
    if (group.items.length <= remaining) {
      out.push(group)
      remaining -= group.items.length
    } else {
      out.push({ ...group, items: group.items.slice(0, remaining) })
      remaining = 0
    }
  }
  return out
}

export function nextRowCount(current: number, step: number, total: number): number {
  return Math.min(current + step, total)
}

function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const shifted = new Date(Date.UTC(y, m - 1, d + days))
  return shifted.toISOString().slice(0, 10)
}

/** "Today · Sep 17", "Yesterday · Sep 16", otherwise the full date. */
export function dayLabel(
  date: string,
  today: string,
  format: { short: (date: string) => string; full: (date: string) => string },
): string {
  if (date === today) return `Today · ${format.short(date)}`
  if (date === shiftDate(today, -1)) return `Yesterday · ${format.short(date)}`
  return format.full(date)
}
