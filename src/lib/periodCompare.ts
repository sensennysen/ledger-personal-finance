import { amountInCurrency, type RateTable } from './exchangeRates.ts'

/** The subset of a transaction the period maths reads. */
export interface PeriodTransaction {
  date: string
  type: string
  amount: number
  currency: string
  exchange_rate?: number | null
  to_account_id?: string | null
  transfer_fee?: number | null
  /** What a transfer between two currencies credited its destination, and that account's currency (LED-185). */
  destination_amount?: number | null
  to_account?: { currency?: string | null } | null
}

/** The cycle key ("YYYY-MM") before the given one. */
export function previousCycleKey(cycleKey: string): string {
  const [year, month] = cycleKey.split('-').map(Number)
  const date = new Date(year, month - 2, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Short month name for a cycle key: "2026-08" → "Aug". */
export function cycleMonthLabel(cycleKey: string): string {
  const [year, month] = cycleKey.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short' })
}

interface Window {
  start: string
  end: string
}

/** A local "YYYY-MM-DD" as a Date at local midnight. */
function parseDay(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * The two windows a previous-period comparison sets side by side (LED-237). While the current
 * cycle is open, day 1 to N of it (N = today's day in the cycle) is set against day 1 to N of the
 * previous one, or all of the previous one when it is shorter. A closed cycle compares whole with
 * whole. `partial` is true when the previous window is cut short, so the label names its days.
 */
export function likeForLikeWindows(current: Window, previous: Window, today: string): { current: Window; previous: Window; partial: boolean } {
  if (today < current.start || today > current.end) return { current, previous, partial: false }
  const start = parseDay(current.start)
  const days = Math.round((parseDay(today).getTime() - start.getTime()) / 86400000) + 1
  const prevStart = parseDay(previous.start)
  const cut = formatDay(new Date(prevStart.getFullYear(), prevStart.getMonth(), prevStart.getDate() + days - 1))
  const previousEnd = cut < previous.end ? cut : previous.end
  return {
    current: { start: current.start, end: today },
    previous: { start: previous.start, end: previousEnd },
    partial: previousEnd < previous.end,
  }
}

/** What the comparison is against: "Aug" for a whole cycle, "Aug 25 – Aug 28" for part of one (LED-237). */
export function comparisonLabel(previousKey: string, windows: { previous: Window; partial: boolean }): string {
  if (!windows.partial) return cycleMonthLabel(previousKey)
  const short = (date: string) => parseDay(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${short(windows.previous.start)} – ${short(windows.previous.end)}`
}

/**
 * Income, expenses and net for transactions dated within [start, end], converted into `target`.
 * A row with no rate is left out and its currency named, never counted at a rate of 1 (LED-183).
 */
export function summarizeRange(transactions: PeriodTransaction[], start: string, end: string, target: string, table: RateTable | null = null) {
  let income = 0
  let expenses = 0
  const excluded = new Set<string>()
  for (const t of transactions) {
    if (t.date < start || t.date > end) continue
    if (t.type !== 'income' && t.type !== 'expense') continue
    const amount = amountInCurrency({ ...t, exchange_rate: t.exchange_rate ?? null }, target, table)
    if (amount === null) {
      excluded.add(t.currency)
      continue
    }
    if (t.type === 'income') income += amount
    else expenses += amount
  }
  return { income, expenses, net: income - expenses, excludedCurrencies: [...excluded].sort() }
}

/**
 * How one transaction moved net worth. Transfers between own accounts only
 * cost their fee; an expense paid into another account (a card payment) is
 * a transfer in disguise and moves nothing.
 */
export function netWorthEffect(tx: PeriodTransaction): number {
  if (tx.type === 'income') return tx.amount
  if (tx.type === 'expense' && !tx.to_account_id) return -tx.amount
  if (tx.type === 'transfer') return tx.transfer_fee ? -tx.transfer_fee : 0
  return 0
}

/**
 * `netWorthEffect`, converted into `target`; null means no rate converts it (LED-184). A transfer
 * fee converts by its own currency. A transfer between two currencies (LED-185) also moves net
 * worth by what arrived less what left, each converted into `target` by the rate table: sending
 * 100 USD that arrives as 91.50 EUR is worth whatever those two figures are worth today.
 */
export function convertedNetWorthEffect(tx: PeriodTransaction, target: string, table: RateTable | null): number | null {
  if (tx.type === 'income') return amountInCurrency({ ...tx, exchange_rate: tx.exchange_rate ?? null }, target, table)
  if (tx.type === 'expense' && !tx.to_account_id) {
    const amount = amountInCurrency({ ...tx, exchange_rate: tx.exchange_rate ?? null }, target, table)
    return amount === null ? null : -amount
  }
  if (tx.type === 'transfer') {
    let effect = 0
    if (tx.transfer_fee) {
      const fee = amountInCurrency({ amount: tx.transfer_fee, currency: tx.currency, exchange_rate: null }, target, table)
      if (fee === null) return null
      effect -= fee
    }
    const toCurrency = tx.to_account?.currency
    if (tx.destination_amount != null && toCurrency && toCurrency !== tx.currency) {
      const sent = amountInCurrency({ amount: tx.amount, currency: tx.currency, exchange_rate: null }, target, table)
      const received = amountInCurrency({ amount: tx.destination_amount, currency: toCurrency, exchange_rate: null }, target, table)
      if (sent === null || received === null) return null
      effect += received - sent
    }
    return effect
  }
  return 0
}

export type Direction = 'up' | 'down' | 'flat'

/**
 * Change against the previous period as a rounded percentage (one decimal).
 * pct is null when there is nothing to compare against.
 */
export function compareToPrevious(current: number, previous: number): { pct: number | null; direction: Direction } {
  if (previous === 0) {
    return { pct: null, direction: current > 0 ? 'up' : current < 0 ? 'down' : 'flat' }
  }
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10
  return { pct: Math.abs(pct), direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' }
}

/** "↑ 11.8% vs Aug", "Same as Aug", or "Nothing in Aug to compare". */
export function formatComparison(cmp: { pct: number | null; direction: Direction }, label: string): string {
  if (cmp.pct === null) return cmp.direction === 'flat' ? `Same as ${label}` : `Nothing in ${label} to compare`
  if (cmp.direction === 'flat') return `Same as ${label}`
  return `${cmp.direction === 'up' ? '↑' : '↓'} ${cmp.pct}% vs ${label}`
}
