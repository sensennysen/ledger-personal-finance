// Category breakdown (spec §7 V4): at 20–50 categories a pie is unreadable, so
// above PIE_MAX_CATEGORIES the Reports card ranks bars, shows the top
// RANKED_TOP and rolls the tail into one expandable "Other" row with its own share.

import { amountInCurrency, type RateTable } from './exchangeRates.ts'

export const PIE_MAX_CATEGORIES = 12
export const RANKED_TOP = 8
export const OTHER_PREVIEW = 6

const NO_CATEGORY = '__none__'
const NO_SUBCATEGORY = '__none__'

interface BreakdownTx {
  type: 'income' | 'expense' | 'transfer'
  amount: number
  currency: string
  exchange_rate?: number | null
  category_id?: string | null
  subcategory_id?: string | null
  subcategory?: { id: string; name: string } | null
}

interface BreakdownCategory {
  name: string
  color: string
}

export interface SubcategorySlice {
  key: string
  name: string
  amount: number
  /** Share of the parent category, 0–1. */
  share: number
}

export interface CategorySlice {
  /** Category id, or '__none__' for uncategorized. Names are not unique; ids are. */
  key: string
  name: string
  color: string
  amount: number
  /** Share of total expenses, 0–1. */
  share: number
  subcategories: SubcategorySlice[]
}

export interface OtherSlice {
  count: number
  amount: number
  share: number
  rows: CategorySlice[]
}

export interface BreakdownRollup {
  mode: 'pie' | 'ranked'
  total: number
  top: CategorySlice[]
  other: OtherSlice | null
}

const shareOf = (amount: number, total: number) => (total > 0 ? amount / total : 0)

export interface CategoryBreakdownResult {
  rows: CategorySlice[]
  /** Currencies left out of every row because no exchange rate converts them (LED-183). */
  excludedCurrencies: string[]
}

/** Expenses by category, converted into `target`; a row with no rate is left out and named. */
export function buildCategoryBreakdown(
  transactions: BreakdownTx[],
  categoryById: Map<string, BreakdownCategory>,
  target: string,
  table: RateTable | null = null,
): CategoryBreakdownResult {
  const map = new Map<string, { name: string; color: string; amount: number; subs: Map<string, { name: string; amount: number }> }>()
  const excluded = new Set<string>()
  for (const t of transactions) {
    if (t.type !== 'expense') continue
    const amount = amountInCurrency({ ...t, exchange_rate: t.exchange_rate ?? null }, target, table)
    if (amount === null) {
      excluded.add(t.currency)
      continue
    }
    const key = t.category_id ?? NO_CATEGORY
    let entry = map.get(key)
    if (!entry) {
      const cat = t.category_id ? categoryById.get(t.category_id) : undefined
      entry = { name: cat?.name ?? 'Uncategorized', color: cat?.color ?? 'var(--muted-foreground)', amount: 0, subs: new Map() }
      map.set(key, entry)
    }
    entry.amount += amount

    const subKey = t.subcategory_id ?? NO_SUBCATEGORY
    const sub = entry.subs.get(subKey)
    if (sub) sub.amount += amount
    else entry.subs.set(subKey, { name: t.subcategory_id ? (t.subcategory?.name ?? 'Subcategory') : 'No subcategory', amount })
  }

  const total = Array.from(map.values()).reduce((sum, e) => sum + e.amount, 0)
  const rows = Array.from(map.entries())
    .map(([key, e]) => ({
      key,
      name: e.name,
      color: e.color,
      amount: e.amount,
      share: shareOf(e.amount, total),
      subcategories: Array.from(e.subs.entries())
        .map(([subKey, s]) => ({ key: subKey, name: s.name, amount: s.amount, share: shareOf(s.amount, e.amount) }))
        .sort((a, b) => b.amount - a.amount),
    }))
    .sort((a, b) => b.amount - a.amount)

  return { rows, excludedCurrencies: [...excluded].sort() }
}

/** Pie at 12 or fewer categories; above that the top 8 plus one "Other" row. */
export function rollupBreakdown(rows: CategorySlice[]): BreakdownRollup {
  const total = rows.reduce((sum, r) => sum + r.amount, 0)
  if (rows.length <= PIE_MAX_CATEGORIES) return { mode: 'pie', total, top: rows, other: null }

  const top = rows.slice(0, RANKED_TOP)
  const tail = rows.slice(RANKED_TOP)
  const amount = tail.reduce((sum, r) => sum + r.amount, 0)
  return {
    mode: 'ranked',
    total,
    top,
    other: { count: tail.length, amount, share: shareOf(amount, total), rows: tail },
  }
}

/** The first few "Other" rows, and what the "N more" line stands for. */
export function previewOther(other: OtherSlice): { shown: CategorySlice[]; more: { count: number; amount: number } | null } {
  const shown = other.rows.slice(0, OTHER_PREVIEW)
  const rest = other.rows.slice(OTHER_PREVIEW)
  if (rest.length === 0) return { shown, more: null }
  return { shown, more: { count: rest.length, amount: rest.reduce((sum, r) => sum + r.amount, 0) } }
}

/** The rail's "Top categories, this filter" (29a): the biggest few, the rest as one "Other" line. */
export function topCategories(
  rows: CategorySlice[],
  count = 4,
): { top: CategorySlice[]; other: { count: number; amount: number } | null } {
  const top = rows.slice(0, count)
  const tail = rows.slice(count)
  if (tail.length === 0) return { top, other: null }
  return { top, other: { count: tail.length, amount: tail.reduce((sum, r) => sum + r.amount, 0) } }
}
