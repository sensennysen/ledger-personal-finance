// Reorder helpers for the Categories list and a category's subcategories (LED-240).
// Each returns the same array when nothing moves, so callers can skip the save.

/** Moves `fromId` to where `toId` is (a drop). */
export function reorderIds(ids: string[], fromId: string, toId: string): string[] {
  const from = ids.indexOf(fromId)
  const to = ids.indexOf(toId)
  if (from < 0 || to < 0 || from === to) return ids
  const next = [...ids]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/** Moves `id` one place up (-1) or down (1). */
export function moveId(ids: string[], id: string, direction: -1 | 1): string[] {
  const index = ids.indexOf(id)
  const targetIndex = index + direction
  if (index < 0 || targetIndex < 0 || targetIndex >= ids.length) return ids
  const next = [...ids]
  const current = next[index]
  next[index] = next[targetIndex]
  next[targetIndex] = current
  return next
}

/** Applies a new order of a visible subset (one tab) to the full list, leaving the others in place. */
export function mergeSubsetOrder(allIds: string[], subsetIds: string[]): string[] {
  const subset = new Set(subsetIds)
  let pointer = 0
  return allIds.map((id) => (subset.has(id) ? subsetIds[pointer++] : id))
}

/** What a screen reader hears after a move: 1-based position of the visible list. */
export function moveAnnouncement(name: string, ids: string[], id: string): string {
  return `${name} moved to position ${ids.indexOf(id) + 1} of ${ids.length}.`
}
