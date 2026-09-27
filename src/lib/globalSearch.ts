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
  account_id?: string
  to_account_id?: string | null
  category_id?: string | null
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
// Design 29a: each group draws three rows and states its true count.
export const GROUP_CAP = 3

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

// `accountId` narrows to rows that leave or enter that account (⌘F in the palette).
export function inScope<T extends { date: string; account_id?: string; to_account_id?: string | null }>(
  rows: T[],
  scope: SearchScope,
  range: SearchRange,
  accountId?: string,
): T[] {
  return rows.filter((row) => {
    if (accountId && row.account_id !== accountId && row.to_account_id !== accountId) return false
    if (scope === 'all') return true
    const day = row.date.slice(0, 10)
    return day >= range.start && day <= range.end
  })
}

const matchesText = (row: SearchableTransaction, needle: string) =>
  includes(row.description, needle) ||
  includes(row.notes, needle) ||
  includes(row.account?.name, needle) ||
  includes(row.to_account?.name, needle) ||
  includes(row.category?.name, needle)

// Cents away from the target, or null when outside the ±AMOUNT_BAND band.
function amountDistance(amount: number, targetCents: number): number | null {
  const distance = Math.abs(toCents(amount) - targetCents)
  if (distance === 0) return 0
  return targetCents > 0 && distance <= targetCents * AMOUNT_BAND ? distance : null
}

/**
 * One row-level predicate for the palette and the Activity / Account search
 * boxes, so "See all in Activity" lands on exactly the rows the palette counted.
 * An empty query matches everything.
 */
export function searchMatcher(query: string): (row: SearchableTransaction) => boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return () => true
  const target = parseAmountQuery(needle)
  const targetCents = target === null ? null : toCents(target)
  return (row) =>
    (targetCents !== null && amountDistance(row.amount, targetCents) !== null) ||
    matchesText(row, needle)
}

export function searchTransactions<T extends SearchableTransaction>(
  rows: T[],
  query: string,
  scope: SearchScope,
  range: SearchRange,
  accountId?: string,
): TransactionMatches<T> {
  const needle = query.trim().toLowerCase()
  const empty = { exact: [], nearby: [], text: [] }
  if (!needle) return empty

  const scoped = inScope(rows, scope, range, accountId)
  const target = parseAmountQuery(needle)
  const exact: T[] = []
  const nearby: T[] = []
  const claimed = new Set<string>()

  if (target !== null) {
    const targetCents = toCents(target)
    const banded: { row: T; distance: number }[] = []
    for (const row of scoped) {
      const distance = amountDistance(row.amount, targetCents)
      if (distance === 0) exact.push(row)
      else if (distance !== null) banded.push({ row, distance })
    }
    banded.sort((a, b) => a.distance - b.distance)
    for (const { row } of banded) nearby.push(row)
    for (const row of [...exact, ...nearby]) claimed.add(row.id)
  }

  const text = scoped.filter((row) => !claimed.has(row.id) && matchesText(row, needle))
  return { exact, nearby, text }
}

// Matched transactions per category id, in match order.
export function categoryMatches<T extends SearchableTransaction>(matches: T[]): Map<string, T[]> {
  const byCategory = new Map<string, T[]>()
  for (const row of matches) {
    if (!row.category_id) continue
    const rows = byCategory.get(row.category_id)
    if (rows) rows.push(row)
    else byCategory.set(row.category_id, [row])
  }
  return byCategory
}

/**
 * Design 29a: a category shows up when its name matches or when matched
 * transactions sit inside it ("Transport · contains 211 matches"). Ranked by
 * relevance: most matched transactions first, so a heavy match is never hidden
 * behind a name-only match under the group cap (LED-137). A name match breaks
 * ties; equal rows keep their incoming order.
 */
export function mergeCategoryResults<T extends SearchableNamed>(
  categories: T[],
  query: string,
  matchCounts: Map<string, number>,
): T[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  return categories
    .map((category) => ({
      category,
      named: includes(category.name, needle),
      count: matchCounts.get(category.id) ?? 0,
    }))
    .filter((row) => row.named || row.count > 0)
    .sort((a, b) => b.count - a.count || Number(b.named) - Number(a.named))
    .map((row) => row.category)
}

export interface SearchHandoff {
  path: string
  /** Rows the destination will show for this query. */
  count: number
  /** True when the destination shows every transaction the palette counted. */
  complete: boolean
  label: string
}

/**
 * Where "See all" lands. An account scope opens that account's full history;
 * otherwise Activity, which is bound to the selected cycle. For an all-time
 * search the label states the cycle count instead of promising rows Activity
 * cannot show.
 */
export function buildHandoff({
  query,
  scope,
  paletteTotal,
  cycleCount,
  account,
  accountCount,
}: {
  query: string
  scope: SearchScope
  paletteTotal: number
  cycleCount: number
  account?: { id: string; name: string } | null
  accountCount?: number
}): SearchHandoff {
  const q = `?q=${encodeURIComponent(query.trim())}`
  if (account) {
    const count = accountCount ?? 0
    return {
      path: `/accounts/${account.id}${q}`,
      count,
      complete: count === paletteTotal,
      label: `See all in ${account.name}`,
    }
  }
  if (scope === 'all' && cycleCount !== paletteTotal) {
    return {
      path: `/transactions${q}`,
      count: cycleCount,
      complete: false,
      label: `See ${cycleCount} this cycle in Activity`,
    }
  }
  return { path: `/transactions${q}`, count: cycleCount, complete: true, label: 'See all in Activity' }
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

export interface TextPart {
  text: string
  match: boolean
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Splits `text` around case-insensitive occurrences of the query, for <mark>.
 * An amount query matches on numbers, not text, so it highlights nothing.
 */
export function highlightParts(text: string, query: string): TextPart[] {
  const needle = query.trim()
  if (!text || !needle || parseAmountQuery(needle) !== null) return [{ text, match: false }]
  const parts: TextPart[] = []
  let last = 0
  for (const found of text.matchAll(new RegExp(escapeRegExp(needle), 'gi'))) {
    const at = found.index ?? 0
    if (at > last) parts.push({ text: text.slice(last, at), match: false })
    parts.push({ text: found[0], match: true })
    last = at + found[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last), match: false })
  return parts.length > 0 ? parts : [{ text, match: false }]
}

export type SearchGroupId = 'transactions' | 'accounts' | 'categories' | 'saved' | 'actions'
export type SearchChip = 'all' | SearchGroupId

export interface ChipCount {
  id: SearchChip
  label: string
  count: number
}

const CHIP_LABELS: Record<SearchGroupId, string> = {
  transactions: 'Transactions',
  accounts: 'Accounts',
  categories: 'Categories',
  saved: 'Saved filters',
  actions: 'Actions',
}

/**
 * Filter chips for 16a: "All" plus one per group that has results. Counts are
 * the groups' true totals (the same numbers the headings state), never the
 * capped rows drawn.
 */
export function groupChips(totals: Record<SearchGroupId, number>): ChipCount[] {
  const groups = (Object.keys(CHIP_LABELS) as SearchGroupId[]).filter((id) => totals[id] > 0)
  const all = groups.reduce((sum, id) => sum + totals[id], 0)
  if (all === 0) return []
  return [
    { id: 'all', label: 'All', count: all },
    ...groups.map((id) => ({ id, label: CHIP_LABELS[id], count: totals[id] })),
  ]
}

/** The chip in force: a chip whose group emptied after typing falls back to All. */
export function resolveChip(active: SearchChip, chips: ChipCount[]): SearchChip {
  return chips.some((chip) => chip.id === active) ? active : 'all'
}

export const chipShows = (chip: SearchChip, group: SearchGroupId) => chip === 'all' || chip === group

export type CategoryAction =
  | { id: 'new'; kind: 'expense' | 'income'; label: string }
  | { id: 'edit-budget'; label: string; budgetId: string }

/**
 * What a category row offers beyond opening Categories: a new entry in it
 * (income for an income-only category) and, when it has a budget, its editor.
 */
export function categoryActions(
  category: { name: string; type: 'expense' | 'income' | 'transfer' | 'both' },
  budgetId: string | null,
): CategoryAction[] {
  const kind = category.type === 'income' ? 'income' : 'expense'
  const actions: CategoryAction[] = [{ id: 'new', kind, label: `New ${kind} in ${category.name}` }]
  if (budgetId) actions.push({ id: 'edit-budget', label: `Edit the ${category.name} budget`, budgetId })
  return actions
}

/** Budgets opens the edit dialog for this budget once it has loaded. */
export const budgetEditPath = (budgetId: string) => `/budgets?edit=${encodeURIComponent(budgetId)}`
