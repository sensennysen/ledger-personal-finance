// Category suggestions on import (LED-74). Instead of importing every row
// uncategorized, each row gets the category the user's own rules or history
// say that payee belongs in; the rest are left for the user to choose.
// A rule is an explicit choice, so it wins over history.

import { normaliseDescription } from './importDuplicates.ts'

type Kind = 'income' | 'expense' | 'transfer'

export interface HistoryTx {
  description: string | null
  category_id: string
  type: Kind
  date: string
}

export interface CategoryRule {
  keyword: string
  category_id: string | null
  priority: number
}

export interface SuggestableCategory {
  id: string
  type: Kind | 'both'
}

/** Normalised payee + type → the category it was most often filed under. */
export type PayeeMemory = ReadonlyMap<string, string>

export interface Suggestion {
  categoryId: string
  source: 'rule' | 'history'
}

const payeeKey = (type: string, description: string | null) => `${type}|${normaliseDescription(description)}`

/**
 * The most frequent category per payee and type. A tie goes to the category
 * used most recently, since that's the user's current habit.
 */
export function buildPayeeMemory(history: readonly HistoryTx[]): PayeeMemory {
  const tallies = new Map<string, Map<string, { count: number; last: string }>>()
  for (const tx of history) {
    if (!normaliseDescription(tx.description)) continue
    const key = payeeKey(tx.type, tx.description)
    let byCategory = tallies.get(key)
    if (!byCategory) {
      byCategory = new Map()
      tallies.set(key, byCategory)
    }
    const tally = byCategory.get(tx.category_id)
    if (tally) {
      tally.count++
      if (tx.date > tally.last) tally.last = tx.date
    } else {
      byCategory.set(tx.category_id, { count: 1, last: tx.date })
    }
  }

  const memory = new Map<string, string>()
  for (const [key, byCategory] of tallies) {
    let best: { id: string; count: number; last: string } | null = null
    for (const [id, tally] of byCategory) {
      if (!best || tally.count > best.count || (tally.count === best.count && tally.last > best.last)) {
        best = { id, ...tally }
      }
    }
    if (best) memory.set(key, best.id)
  }
  return memory
}

/**
 * A category for an imported row, or null. Only categories that fit the row's
 * type (or are 'both') are suggested. Rules match as they do on entry: the
 * highest-priority keyword the description contains.
 */
export function suggestCategory(
  row: { description: string; type: 'income' | 'expense' | null },
  rules: readonly CategoryRule[],
  memory: PayeeMemory,
  categories: ReadonlyMap<string, SuggestableCategory>,
): Suggestion | null {
  const type = row.type
  if (!type) return null
  const fits = (id: string | null | undefined): id is string => {
    const category = id ? categories.get(id) : undefined
    return Boolean(category && (category.type === type || category.type === 'both'))
  }

  const lower = row.description.toLowerCase()
  const rule = [...rules]
    .sort((a, b) => b.priority - a.priority)
    .find((item) => item.keyword && lower.includes(item.keyword.toLowerCase()) && fits(item.category_id))
  if (rule) return { categoryId: rule.category_id!, source: 'rule' }

  if (!normaliseDescription(row.description)) return null
  const remembered = memory.get(payeeKey(type, row.description))
  return fits(remembered) ? { categoryId: remembered, source: 'history' } : null
}
