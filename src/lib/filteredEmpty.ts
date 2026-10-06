// The Activity page's empty state once filters hide every row of a cycle that
// has some (QA-004). It names the filters, not the period, so an empty search
// doesn't read as a cycle with no transactions.

export interface ActivityFilters {
  type: string
  search: string
  tag: string | null
}

export function filteredEmptyMessage(filters: ActivityFilters, range: string): { title: string; description: string } {
  const parts: string[] = []
  if (filters.search.trim()) parts.push(`“${filters.search.trim()}”`)
  if (filters.type !== 'all') parts.push(`type ${filters.type}`)
  if (filters.tag) parts.push(`tag #${filters.tag}`)
  return {
    title: 'No transactions match your filters',
    description: parts.length
      ? `Nothing in ${range} matches ${parts.join(', ')}.`
      : `Nothing in ${range} matches the current filters.`,
  }
}
