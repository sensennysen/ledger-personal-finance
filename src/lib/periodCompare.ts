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
 * `netWorthEffect`, converted into `target`; null means no rate converts it (LED-184). A
 * transfer fee converts by its own currency, not the transfer's own cross-currency rate
 * (that rate is between the two accounts, not into `target` — LED-185, not decided here).
 */
export function convertedNetWorthEffect(tx: PeriodTransaction, target: string, table: RateTable | null): number | null {
  if (tx.type === 'income') return amountInCurrency({ ...tx, exchange_rate: tx.exchange_rate ?? null }, target, table)
  if (tx.type === 'expense' && !tx.to_account_id) {
    const amount = amountInCurrency({ ...tx, exchange_rate: tx.exchange_rate ?? null }, target, table)
    return amount === null ? null : -amount
  }
  if (tx.type === 'transfer' && tx.transfer_fee) {
    const fee = amountInCurrency({ amount: tx.transfer_fee, currency: tx.currency, exchange_rate: null }, target, table)
    return fee === null ? null : -fee
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
