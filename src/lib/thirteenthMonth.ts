// 13th Month Pay selection helpers (LED-97). Under PD 851 only basic salary
// counts, and the category is already on every income record, so one click can
// pre-tick the salary rows and turn a manual pass into a review.

export interface IncomeRecord {
  id: string
  date: string
  category?: { name: string } | null
}

export const UNCATEGORISED = 'Uncategorised'

const SALARY_PATTERN = /\b(salary|salaries|wages?|basic pay|payroll)\b/i

export function isSalaryCategory(name: string | null | undefined): boolean {
  return !!name && SALARY_PATTERN.test(name)
}

/** Ids of the records whose category reads as basic salary. */
export function salaryOnlySelection(records: IncomeRecord[]): Set<string> {
  return new Set(records.filter((r) => isSalaryCategory(r.category?.name)).map((r) => r.id))
}

/** Records left out of the selection, counted by category, most first. */
export function excludedByCategory(
  records: IncomeRecord[],
  included: Set<string>,
): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const r of records) {
    if (included.has(r.id)) continue
    const name = r.category?.name || UNCATEGORISED
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

export function monthKey(date: string): string {
  return date.slice(0, 7)
}

/** Records grouped by YYYY-MM: months ascending, records newest first. */
export function groupByMonth<T extends IncomeRecord>(records: T[]): [string, T[]][] {
  const map = new Map<string, T[]>()
  for (const r of records) {
    const key = monthKey(r.date)
    const arr = map.get(key)
    if (arr) arr.push(r)
    else map.set(key, [r])
  }
  for (const arr of map.values()) arr.sort((a, b) => b.date.localeCompare(a.date))
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
}
