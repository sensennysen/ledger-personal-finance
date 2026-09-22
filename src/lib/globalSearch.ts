// Pure matching for the global search palette. No app imports, so node --test
// can load it. Cycle scope is an explicit argument: this module never reads
// cycle state, so the caller decides (and shows) which range is searched.

export type SearchScope = 'cycle' | 'all'

export interface SearchRange {
  start: string
  end: string
}

export interface SearchableTransaction {
  id: string
  date: string
  amount: number
  description: string
  notes?: string | null
  account?: { name: string } | null
  to_account?: { name: string } | null
  category?: { name: string } | null
}

export interface SearchableNamed {
  id: string
  name: string
}

export interface SearchAction {
  id: string
  label: string
  keywords: string[]
  key?: string
}

export interface TransactionMatches<T> {
  exact: T[]
  nearby: T[]
  text: T[]
}

// Fraction either side of an exact amount that still counts as "nearby".
export const AMOUNT_BAND = 0.05
export const GROUP_CAP = 8

const toCents = (value: number) => Math.round(Math.abs(value) * 100)

// "86.40", "1,012.40", "$86" -> number. Anything else (words, mixed) -> null.
export function parseAmountQuery(query: string): number | null {
  const cleaned = query.trim().replace(/^[^\d.-]+/, '').replace(/,/g, '')
  if (!/^\d+(\.\d+)?$/.test(cleaned.replace(/^-/, ''))) return null
  const value = Math.abs(Number(cleaned))
  return Number.isFinite(value) ? value : null
}

const includes = (haystack: string | null | undefined, needle: string) =>
  !!haystack && haystack.toLowerCase().includes(needle)

export function inScope<T extends { date: string }>(
  rows: T[],
  scope: SearchScope,
  range: SearchRange,
): T[] {
  if (scope === 'all') return rows
  return rows.filter((row) => {
    const day = row.date.slice(0, 10)
    return day >= range.start && day <= range.end
  })
}

export function searchTransactions<T extends SearchableTransaction>(
  rows: T[],
  query: string,
  scope: SearchScope,
  range: SearchRange,
): TransactionMatches<T> {
  const needle = query.trim().toLowerCase()
  const empty = { exact: [], nearby: [], text: [] }
  if (!needle) return empty

  const scoped = inScope(rows, scope, range)
  const target = parseAmountQuery(needle)
  const exact: T[] = []
  const nearby: T[] = []
  const claimed = new Set<string>()

  if (target !== null) {
    const targetCents = toCents(target)
    const bandCents = targetCents * AMOUNT_BAND
    const banded: { row: T; distance: number }[] = []
    for (const row of scoped) {
      const distance = Math.abs(toCents(row.amount) - targetCents)
      if (distance === 0) exact.push(row)
      else if (targetCents > 0 && distance <= bandCents) banded.push({ row, distance })
    }
    banded.sort((a, b) => a.distance - b.distance)
    for (const { row } of banded) nearby.push(row)
    for (const row of [...exact, ...nearby]) claimed.add(row.id)
  }

  const text = scoped.filter(
    (row) =>
      !claimed.has(row.id) &&
      (includes(row.description, needle) ||
        includes(row.notes, needle) ||
        includes(row.account?.name, needle) ||
        includes(row.to_account?.name, needle) ||
        includes(row.category?.name, needle)),
  )
  return { exact, nearby, text }
}

export function searchNamed<T extends SearchableNamed>(rows: T[], query: string): T[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  return rows.filter((row) => includes(row.name, needle))
}

// An empty query lists every action so the E / I / T keys have something to fire.
export function matchActions(actions: SearchAction[], query: string): SearchAction[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return actions
  return actions.filter(
    (action) =>
      includes(action.label, needle) || action.keywords.some((word) => includes(word, needle)),
  )
}

export interface Group<T> {
  items: T[]
  total: number
}

// Cap what is drawn but keep the true count, so "Show all N" stays honest.
export function capGroup<T>(rows: T[], cap: number = GROUP_CAP): Group<T> {
  return { items: rows.slice(0, cap), total: rows.length }
}

export interface SearchDestination {
  id: string
  label: string
  path: string
}

// Design 16a "Jump to" order. Import CSV is a dialog on Activity, so it
// lands there.
export const DESTINATIONS: SearchDestination[] = [
  { id: 'accounts', label: 'Accounts', path: '/accounts' },
  { id: 'activity', label: 'Activity', path: '/transactions' },
  { id: 'budgets', label: 'Budgets', path: '/budgets' },
  { id: 'categories', label: 'Categories', path: '/categories' },
  { id: 'reports', label: 'Reports', path: '/reports' },
  { id: 'settings', label: 'Settings', path: '/settings' },
  { id: 'import-csv', label: 'Import CSV', path: '/transactions?import=1' },
]

export const DUE_SOON_DAYS = 14

// Structural shape of getLoanDeadlines() output, so this module needs no app imports.
export interface DeadlineLike {
  dueDate: string
  total: number
  items: { purchaseId: string; purchaseName: string; remainingAmount: number }[]
}

export interface DueSoonRow {
  id: string
  purchaseId: string
  label: string
  dueDate: string
  daysAway: number
  amount: number
}

function dayNumber(date: string): number {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number)
  return Math.round(Date.UTC(year, month - 1, day) / 86400000)
}

// Installments due from `today` through `windowDays` ahead, soonest first.
// `today` is an argument (YYYY-MM-DD) so the caller owns the clock.
export function buildDueSoon(
  deadlines: DeadlineLike[],
  today: string,
  windowDays: number = DUE_SOON_DAYS,
): DueSoonRow[] {
  const base = dayNumber(today)
  const rows: DueSoonRow[] = []
  for (const deadline of deadlines) {
    const daysAway = dayNumber(deadline.dueDate) - base
    if (daysAway < 0 || daysAway > windowDays) continue
    for (const item of deadline.items) {
      rows.push({
        id: `${item.purchaseId}:${deadline.dueDate}`,
        purchaseId: item.purchaseId,
        label: item.purchaseName,
        dueDate: deadline.dueDate,
        daysAway,
        amount: item.remainingAmount,
      })
    }
  }
  return rows.sort((a, b) => a.daysAway - b.daysAway || a.label.localeCompare(b.label))
}

// How many loan purchases still owe something, and how much in total.
export function summarizeLoans(deadlines: DeadlineLike[]): { count: number; owed: number } {
  const purchases = new Set<string>()
  let owed = 0
  for (const deadline of deadlines) {
    for (const item of deadline.items) {
      purchases.add(item.purchaseId)
      owed += item.remainingAmount
    }
  }
  return { count: purchases.size, owed: Math.round((owed + Number.EPSILON) * 100) / 100 }
}
