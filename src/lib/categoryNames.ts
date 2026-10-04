// Category names are unique within their parent (LED-233): among a user's categories,
// and among one category's subcategories. The database trigger is the guard; this is the
// same check against the loaded list, so the form can say so before a round trip.
// Keep the comparison and the sentences in step with
// supabase/migrations/20261004100000_category_name_unique_within_parent.sql.

export interface NamedSibling {
  id: string
  name: string
}

/** Case-insensitive, surrounding spaces ignored (the trigger's lower(btrim(name))). */
export function normaliseCategoryName(name: string): string {
  return name.trim().toLowerCase()
}

/**
 * The sibling that already uses `name`, or null. `selfId` is the record being renamed:
 * a rename that keeps its own name (or only changes case or spacing) is not a clash,
 * so an existing duplicate can still be tidied.
 */
export function findNameClash<T extends NamedSibling>(
  name: string,
  siblings: readonly T[],
  self?: NamedSibling,
): T | null {
  const target = normaliseCategoryName(name)
  if (!target) return null
  if (self && normaliseCategoryName(self.name) === target) return null
  return siblings.find((sibling) => sibling.id !== self?.id && normaliseCategoryName(sibling.name) === target) ?? null
}

/** The sentence the form shows; the trigger raises the same one. */
export function clashSentence(kind: 'category' | 'subcategory', name: string, parentName?: string): string {
  const trimmed = name.trim()
  return kind === 'category'
    ? `A category named "${trimmed}" already exists.`
    : `A subcategory named "${trimmed}" already exists in ${parentName?.trim() || 'this category'}.`
}
