/** The subset of a transaction the period maths reads. */
export interface PeriodTransaction {
  date: string
  type: string
  amount: number
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

/** Income, expenses and net for transactions dated within [start, end], in the default currency. */
export function summarizeRange(transactions: PeriodTransaction[], start: string, end: string) {
  let income = 0
  let expenses = 0
  for (const t of transactions) {
    if (t.date < start || t.date > end) continue
    if (t.type === 'income') income += t.amount * (t.exchange_rate ?? 1)
    else if (t.type === 'expense') expenses += t.amount * (t.exchange_rate ?? 1)
  }
  return { income, expenses, net: income - expenses }
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
