import { signPrefix } from './netSign.ts'
import { transferCredit } from './transferCredit.ts'

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
  destination_amount?: number | null
  to_account_id?: string | null
  to_account?: { currency?: string | null } | null
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
 * account, money arriving (transfer or loan repayment into it) is positive and is what the
 * destination was credited (transferCredit: the destination amount of a transfer between two
 * currencies), matching TransactionRow.
 */
export function signedAmount(tx: WindowedTx, contextAccountId?: string): number {
  if (contextAccountId !== undefined) {
    const incoming = (tx.type === 'transfer' || tx.type === 'expense') && tx.to_account_id === contextAccountId
    if (incoming) return tx.type === 'transfer' ? transferCredit(tx) : tx.amount * (tx.exchange_rate ?? 1)
    if (tx.type === 'income') return tx.amount
    return -tx.amount
  }
  if (tx.type === 'income') return tx.amount
  if (tx.type === 'expense') return -tx.amount
  return 0
}

/**
 * The currency signedAmount is in. Money arriving in an account is carried at the exchange
 * rate, so it is in the destination account's currency, not the source's (LED-149).
 */
export function signedCurrency(tx: WindowedTx, contextAccountId?: string): string {
  const incoming =
    contextAccountId !== undefined &&
    (tx.type === 'transfer' || tx.type === 'expense') &&
    tx.to_account_id === contextAccountId
  return incoming ? (tx.to_account?.currency ?? tx.currency) : tx.currency
}

/**
 * What a transaction row prints for its amount: the sign, then the size. It follows
 * signedAmount, so the row, the day header and the result-bar sum cannot disagree.
 * Two display-only rules: money arriving is carried at the exchange rate (already in
 * signedAmount), and a transfer going out of the account shows no sign, because it
 * is a move between the user's own accounts, not spending.
 */
export function amountDisplay(tx: WindowedTx, contextAccountId?: string): { sign: string; value: number; currency: string } {
  const signed = signedAmount(tx, contextAccountId)
  const sign = tx.type === 'transfer' && signed < 0 ? '' : signPrefix(signed)
  return { sign, value: signed === 0 ? tx.amount : Math.abs(signed), currency: signedCurrency(tx, contextAccountId) }
}

/**
 * The density the list actually uses. The stored preference is per browser, but the
 * toggle is hidden on a phone, so a Compact set on desktop must not stick there.
 */
export function effectiveDensity(preference: 'comfortable' | 'compact', mobile: boolean): 'comfortable' | 'compact' {
  return mobile ? 'comfortable' : preference
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

/**
 * Activity's sort (LED-241): the two date orders, plus amount largest or smallest first. An amount
 * sort lists rows flat, since day groups would break its order.
 */
export type ActivitySort = TxSort | 'largest' | 'smallest'

export const ACTIVITY_SORTS: readonly ActivitySort[] = ['newest', 'oldest', 'largest', 'smallest']

export function isAmountSort(sort: ActivitySort): sort is 'largest' | 'smallest' {
  return sort === 'largest' || sort === 'smallest'
}

/**
 * Sorted copy by size. `magnitude` gives a row's amount in one currency, or null when it has no
 * rate: those rows are never compared one to one with the rest, so they come last, ordered by their
 * own amount. Equal sizes keep the newest first.
 */
export function sortByAmount<T extends { date: string; amount: number }>(
  txs: T[],
  sort: 'largest' | 'smallest',
  magnitude: (tx: T) => number | null,
): T[] {
  const sign = sort === 'largest' ? -1 : 1
  const keyed = txs.map((tx) => ({ tx, size: magnitude(tx) }))
  keyed.sort((a, b) => {
    if ((a.size === null) !== (b.size === null)) return a.size === null ? 1 : -1
    const left = Math.abs(a.size ?? a.tx.amount)
    const right = Math.abs(b.size ?? b.tx.amount)
    if (left !== right) return sign * (left - right)
    return b.tx.date.localeCompare(a.tx.date)
  })
  return keyed.map((entry) => entry.tx)
}

/** Sum of the signed amounts per currency, as the rows and day headers sign them. */
export function sumByCurrency(txs: WindowedTx[], contextAccountId?: string): Record<string, number> {
  const sum: Record<string, number> = {}
  for (const tx of txs) {
    const currency = signedCurrency(tx, contextAccountId)
    sum[currency] = (sum[currency] ?? 0) + signedAmount(tx, contextAccountId)
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
    // Keyed by the currency TransactionRow labels the amount with.
    const currency = signedCurrency(tx, contextAccountId)
    group.net[currency] = (group.net[currency] ?? 0) + signedAmount(tx, contextAccountId)
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
