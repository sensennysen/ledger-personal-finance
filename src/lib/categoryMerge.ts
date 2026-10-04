// Merge categories (LED-239). The merge itself is one database function,
// public.merge_category (supabase/migrations/20261004120000_merge_category_rpc.sql);
// this mirrors its rules so the confirmation can say what will move.
import { normaliseCategoryName } from './categoryNames.ts'

interface MergeableCategory {
  id: string
  name: string
  type: string
}

/** Categories the source can merge into: not itself, and the same type or 'both'. */
export function mergeTargets<T extends MergeableCategory>(categories: readonly T[], source: MergeableCategory): T[] {
  return categories.filter(
    (category) => category.id !== source.id && (category.type === source.type || category.type === 'both'),
  )
}

interface OrderedSubcategory {
  id: string
  name: string
  sort_order?: number
  created_at: string
}

const bySortOrder = (a: OrderedSubcategory, b: OrderedSubcategory) =>
  (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)

/**
 * How the source's subcategories land, as the function does it: in order, each one joins
 * the target's subcategory of the same name (or one moved just before it), else moves.
 */
export function planSubcategoryMerge(
  source: readonly OrderedSubcategory[],
  target: readonly OrderedSubcategory[],
): { moved: number; folded: number } {
  const names = new Set(target.map((sub) => normaliseCategoryName(sub.name)))
  let moved = 0
  let folded = 0
  for (const sub of [...source].sort(bySortOrder)) {
    const name = normaliseCategoryName(sub.name)
    if (names.has(name)) {
      folded += 1
    } else {
      names.add(name)
      moved += 1
    }
  }
  return { moved, folded }
}

export interface MergeCounts {
  transactions: number
  subcategoriesMoved: number
  subcategoriesFolded: number
  budgets: number
  rules: number
  loanPurchases: number
}

/** Active budgets the target will have once the source's move over. */
export interface MergePreview extends MergeCounts {
  targetActiveBudgets: number
}

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`

function list(parts: string[]): string {
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

function movedParts(counts: MergeCounts): string[] {
  const subcategories = counts.subcategoriesMoved + counts.subcategoriesFolded
  const parts: string[] = []
  if (counts.transactions) parts.push(plural(counts.transactions, 'transaction'))
  if (subcategories) {
    const joins = counts.subcategoriesFolded
      ? ` (${counts.subcategoriesFolded} ${counts.subcategoriesFolded === 1 ? 'joins' : 'join'} one of the same name)`
      : ''
    parts.push(`${plural(subcategories, 'subcategory', 'subcategories')}${joins}`)
  }
  if (counts.budgets) parts.push(plural(counts.budgets, 'budget'))
  if (counts.rules) parts.push(plural(counts.rules, 'auto-categorization rule'))
  if (counts.loanPurchases) parts.push(plural(counts.loanPurchases, 'financed purchase'))
  return parts
}

/** "Moves 4 transactions, 3 subcategories (2 join one of the same name) and 1 budget to Dining, then deletes Groceries." */
export function mergeSentence(counts: MergeCounts, sourceName: string, targetName: string): string {
  const parts = movedParts(counts)
  if (parts.length === 0) return `Nothing uses ${sourceName} yet. Merging deletes it.`
  return `Moves ${list(parts)} to ${targetName}, then deletes ${sourceName}.`
}

/** The same, once done: "Moved 4 transactions … to Dining and deleted Groceries." */
export function mergedSentence(counts: MergeCounts, sourceName: string, targetName: string): string {
  const parts = movedParts(counts)
  if (parts.length === 0) return `Nothing used ${sourceName}, so it was deleted.`
  return `Moved ${list(parts)} to ${targetName} and deleted ${sourceName}.`
}

/** Said when the merge leaves the target with more than one active budget; null otherwise. */
export function budgetNote(movedBudgets: number, targetActiveBudgets: number, targetName: string): string | null {
  if (!movedBudgets || targetActiveBudgets < 2) return null
  return `${targetName} will have ${targetActiveBudgets} budgets. Review them in Budgets.`
}

/** The function's jsonb result, in client names. */
export function parseMergeResult(raw: Record<string, unknown> | null): MergePreview {
  const n = (key: string) => (typeof raw?.[key] === 'number' ? (raw[key] as number) : 0)
  return {
    transactions: n('transactions'),
    subcategoriesMoved: n('subcategories_moved'),
    subcategoriesFolded: n('subcategories_folded'),
    budgets: n('budgets'),
    rules: n('rules'),
    loanPurchases: n('loan_purchases'),
    targetActiveBudgets: n('target_active_budgets'),
  }
}
