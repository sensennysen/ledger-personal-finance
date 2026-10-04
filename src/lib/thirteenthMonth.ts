// 13th Month Pay selection helpers (LED-97). Under PD 851 only basic salary
// counts, and the category is already on every income record, so one click can
// pre-tick the salary rows and turn a manual pass into a review. Which categories
// are salary is the user's flag, categories.counts_as_salary (LED-236), passed in
// as a set of category ids.

export interface IncomeRecord {
  id: string
  date: string
  category_id?: string | null
  category?: { name: string } | null
}

export const UNCATEGORISED = 'Uncategorised'

function isSalary(record: IncomeRecord, salaryCategoryIds: ReadonlySet<string>): boolean {
  return !!record.category_id && salaryCategoryIds.has(record.category_id)
}

/** Ids of the records whose category counts as salary. */
export function salaryOnlySelection(records: IncomeRecord[], salaryCategoryIds: ReadonlySet<string>): Set<string> {
  return new Set(records.filter((r) => isSalary(r, salaryCategoryIds)).map((r) => r.id))
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

export type MonthStatus = 'covered' | 'partial' | 'missing' | 'future'

export interface MonthCoverage {
  /** 1 to 12. */
  month: number
  status: MonthStatus
  includedCount: number
  totalCount: number
}

/**
 * The 12-bar strip of design 15a. A month is `covered` when every income record
 * in it is ticked, `partial` when some are, `missing` when the month has happened
 * and nothing in it is ticked (or it has no income at all), and `future` when it
 * has not started. `today` is "YYYY-MM-DD"; a past year has no future months and a
 * later year is all future.
 */
export function monthCoverage(
  records: IncomeRecord[],
  included: Set<string>,
  year: number,
  today: string,
): MonthCoverage[] {
  const totals = new Map<string, { included: number; total: number }>()
  for (const record of records) {
    const key = monthKey(record.date)
    const entry = totals.get(key) ?? { included: 0, total: 0 }
    entry.total += 1
    if (included.has(record.id)) entry.included += 1
    totals.set(key, entry)
  }
  const thisMonth = today.slice(0, 7)
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1
    const key = `${year}-${String(month).padStart(2, '0')}`
    const counts = totals.get(key) ?? { included: 0, total: 0 }
    let status: MonthStatus
    if (key > thisMonth) status = 'future'
    else if (counts.included === 0) status = 'missing'
    else if (counts.included === counts.total) status = 'covered'
    else status = 'partial'
    return { month, status, includedCount: counts.included, totalCount: counts.total }
  })
}

export type Pd851RowId = 'basic' | 'overtime' | 'allowances' | 'other'

export interface Pd851Row {
  id: Pd851RowId
  label: string
  /** True when PD 851 counts this pay as basic salary. */
  counts: boolean
  /** Ticked records whose category reads like this row. */
  selected: number
}

// The excluded kinds are matched on the category name: they only warn that a ticked record
// looks like pay PD 851 leaves out. Basic salary is the user's flag.
const PD851_PATTERNS: Record<Exclude<Pd851RowId, 'basic'>, RegExp> = {
  overtime: /\b(overtime|holiday|night|premium|differential)\b/i,
  allowances: /\b(allowances?|bonus(es)?|commission|incentives?|benefits?|13th|thirteenth)\b/i,
  other: /\b(freelance|business|investment|dividends?|interest|rental|gifts?|refunds?)\b/i,
}

const PD851_LABELS: Record<Pd851RowId, string> = {
  basic: 'Basic salary: your regular wage for work performed',
  overtime: 'Overtime, holiday and night-shift premiums',
  allowances: 'Allowances, bonuses and other monetary benefits',
  other: 'Income from freelance or non-employment sources',
}

/**
 * The four PD 851 rules as a tick/cross list. Each row also counts the ticked
 * records that look like it, so a cross row with `selected > 0` is a warning
 * that the estimate includes pay PD 851 leaves out.
 */
export function pd851Checklist(
  records: IncomeRecord[],
  included: Set<string>,
  salaryCategoryIds: ReadonlySet<string>,
): Pd851Row[] {
  const ticked = records.filter((record) => included.has(record.id))
  const count = (test: (record: IncomeRecord) => boolean) => ticked.filter(test).length
  return [
    { id: 'basic', label: PD851_LABELS.basic, counts: true, selected: count((r) => isSalary(r, salaryCategoryIds)) },
    ...(['overtime', 'allowances', 'other'] as const).map((id) => ({
      id,
      label: PD851_LABELS[id],
      counts: false,
      selected: count((r) => {
        const name = r.category?.name
        return !!name && !isSalary(r, salaryCategoryIds) && PD851_PATTERNS[id].test(name)
      }),
    })),
  ]
}
