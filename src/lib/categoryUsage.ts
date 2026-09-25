// Usage figures for the Categories screen (LED-152, design 8a): spend this cycle, share of
// spending, all-time transaction count and per-subcategory spend. Pure and relative-only so
// node --test loads it. Unrated currencies are left out of spend and reported, as budgets do.

export interface UsageTx {
  category_id: string | null
  subcategory_id: string | null
  type: 'income' | 'expense' | 'transfer'
  amount: number
  currency: string
  exchange_rate: number | null
  date: string
}

export interface Sides {
  expense: number
  income: number
}

export interface CategoryUsageRow {
  /** Every transaction ever filed under the category, of any type. */
  txCount: number
  /** This cycle's spend by side, in the display currency. A `both` category has each. */
  spend: Sides
  /** This cycle's spend per subcategory id. */
  bySubcategory: Map<string, Sides>
}

export interface CategoryUsage {
  byCategory: Map<string, CategoryUsageRow>
  /** All categorised spend this cycle, the base of each row's share. */
  totals: Sides
  unrated: string[]
}

const emptySides = (): Sides => ({ expense: 0, income: 0 })

export function buildCategoryUsage(
  txs: UsageTx[],
  range: { start: string; end: string },
  currency: string,
): CategoryUsage {
  const byCategory = new Map<string, CategoryUsageRow>()
  const totals = emptySides()
  const unrated = new Set<string>()

  for (const tx of txs) {
    if (!tx.category_id) continue
    let row = byCategory.get(tx.category_id)
    if (!row) {
      row = { txCount: 0, spend: emptySides(), bySubcategory: new Map() }
      byCategory.set(tx.category_id, row)
    }
    row.txCount += 1

    if (tx.type === 'transfer' || tx.date < range.start || tx.date > range.end) continue
    let converted: number
    if (tx.currency === currency) converted = tx.amount
    else if (tx.exchange_rate == null) {
      unrated.add(tx.currency)
      continue
    } else converted = tx.amount * tx.exchange_rate

    row.spend[tx.type] += converted
    totals[tx.type] += converted
    if (tx.subcategory_id) {
      const sub = row.bySubcategory.get(tx.subcategory_id) ?? emptySides()
      sub[tx.type] += converted
      row.bySubcategory.set(tx.subcategory_id, sub)
    }
  }
  return { byCategory, totals, unrated: [...unrated].sort() }
}

/** Whole-number share of `total`, or null when there is nothing to take a share of. */
export function shareOf(amount: number, total: number): number | null {
  return total > 0 ? Math.round((amount / total) * 100) : null
}

/** Categories with no transaction at all; the Unused tab (safe to delete). */
export function unusedCategoryIds(categoryIds: string[], usage: CategoryUsage): string[] {
  return categoryIds.filter((id) => (usage.byCategory.get(id)?.txCount ?? 0) === 0)
}

export function subcategoryCounts(subcategories: { category_id: string }[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const sub of subcategories) counts.set(sub.category_id, (counts.get(sub.category_id) ?? 0) + 1)
  return counts
}

/**
 * What deleting a category costs, in numbers. `txCount` is null while the usage read has not
 * succeeded, and then no number is given: an unknown count is never shown as zero.
 */
export function deleteCostSentence(
  name: string,
  txCount: number | null,
  subcategoryCount: number | null,
): string {
  const subs =
    subcategoryCount && subcategoryCount > 0
      ? ` and its ${subcategoryCount} ${subcategoryCount === 1 ? 'subcategory' : 'subcategories'}`
      : ''
  if (txCount === null) {
    return `This will delete "${name}"${subs}. Transactions using it will become uncategorized.`
  }
  if (txCount === 0) return `This will delete "${name}"${subs}. No transactions use it.`
  return `This will delete "${name}"${subs}. ${txCount} ${txCount === 1 ? 'transaction' : 'transactions'} will become uncategorized.`
}
