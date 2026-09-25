export type ReportColumn =
  | 'date'
  | 'description'
  | 'category'
  | 'account'
  | 'type'
  | 'amount'
  | 'balance'

export const REPORT_COLUMNS: { key: ReportColumn; label: string; required: boolean }[] = [
  { key: 'date', label: 'Date', required: true },
  { key: 'description', label: 'Description', required: true },
  { key: 'category', label: 'Category', required: false },
  { key: 'account', label: 'Account', required: false },
  { key: 'type', label: 'Type', required: false },
  { key: 'amount', label: 'Amount', required: true },
  { key: 'balance', label: 'Balance', required: false },
]

const REQUIRED = new Set(REPORT_COLUMNS.filter((c) => c.required).map((c) => c.key))

/** All seven columns when there is room; only the required ones on a phone. */
export function defaultColumns(wide: boolean): Set<ReportColumn> {
  return new Set(REPORT_COLUMNS.filter((c) => wide || c.required).map((c) => c.key))
}

/** Toggles an optional column. Required columns can never be hidden. */
export function toggleColumn(visible: Set<ReportColumn>, key: ReportColumn): Set<ReportColumn> {
  if (REQUIRED.has(key)) return visible
  const next = new Set(visible)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return next
}

/**
 * The columns an export carries: the ones visible in the table, in table order.
 * Required columns are always present, so a stale or empty set cannot produce a
 * file without a date, description or amount.
 */
export function exportColumns(visible: Set<ReportColumn>): ReportColumn[] {
  return REPORT_COLUMNS.filter((c) => c.required || visible.has(c.key)).map((c) => c.key)
}
