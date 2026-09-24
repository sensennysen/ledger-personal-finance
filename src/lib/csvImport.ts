// CSV import parsing and problem grouping (LED-65, spec §7 V6). Rows that
// can't be imported are kept and flagged instead of silently dropped, then
// grouped by cause so fixing one cause (a date order, say) clears every row
// under it. Errors block the import; warnings import anyway.

export type BankFormat = 'BDO' | 'BPI' | 'Metrobank' | 'Generic'
export type DateOrder = 'MDY' | 'DMY'
export type CauseId = 'bad-date' | 'bad-amount' | 'empty-description' | 'duplicate'
export type Severity = 'error' | 'warning' | 'duplicate'

export const MAX_IMPORT_ROWS = 5000
export const EMPTY_DESCRIPTION = 'No description'

export const CAUSES: Record<CauseId, { label: string; severity: Severity }> = {
  'bad-date': { label: 'Unparseable date', severity: 'error' },
  'bad-amount': { label: 'Amount not a number', severity: 'error' },
  'empty-description': { label: 'Description empty', severity: 'warning' },
  duplicate: { label: 'Matches existing row', severity: 'duplicate' },
}

const CAUSE_ORDER: CauseId[] = ['bad-date', 'bad-amount', 'empty-description', 'duplicate']

export interface ImportRow {
  /** 1-based data row number, counted from the row after the header. */
  line: number
  rawDate: string
  rawAmount: string
  date: string | null
  description: string
  amount: number | null
  type: 'income' | 'expense' | null
  /** Parse problems; duplicates are added later, once the check has run. */
  issues: CauseId[]
}

export interface ParsedFile {
  format: BankFormat
  raw: string[][]
  headerIdx: number
  dateOrder: DateOrder
}

export function parseCSVText(text: string): string[][] {
  const rows: string[][] = []
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  let currentRow: string[] = []
  let currentCell = ''
  let inQuotes = false

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i]
    const next = normalized[i + 1]

    if (ch === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (ch === ',' && !inQuotes) {
      currentRow.push(currentCell.trim())
      currentCell = ''
      continue
    }

    if (ch === '\n' && !inQuotes) {
      currentRow.push(currentCell.trim())
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow)
      }
      currentRow = []
      currentCell = ''
      continue
    }

    currentCell += ch
  }

  if (inQuotes) {
    throw new Error('The CSV file has an unmatched quote. Please export the file again and retry.')
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim())
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow)
    }
  }

  return rows
}

export function findHeaderRowIndex(rows: string[][]): number {
  const keywords = ['date', 'description', 'amount', 'debit', 'credit', 'balance', 'remarks', 'particulars']
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const row = rows[i].map((cell) => cell.toLowerCase())
    const matches = keywords.filter((keyword) => row.some((cell) => cell.includes(keyword))).length
    if (matches >= 2) return i
  }
  return -1
}

export function detectFormat(headers: string[]): BankFormat {
  const normalized = headers.map((cell) => cell.toLowerCase().trim())
  const has = (term: string) => normalized.some((cell) => cell.includes(term))
  if (has('post date') || has('ref. no') || has('reference no')) return 'Metrobank'
  if (has('transaction date') || (has('date') && has('debit') && has('credit'))) return 'BDO'
  if (has('date') && has('amount') && !has('debit') && !has('credit')) return 'BPI'
  return 'Generic'
}

const SHORT_MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

function toISODate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1) return null
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (day > daysInMonth) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const SLASH_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/

/** A statement date as YYYY-MM-DD, or null. Slash dates read in `order`. */
export function parseDate(value: string, order: DateOrder): string | null {
  const clean = value.trim()
  if (!clean) return null

  const iso = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return toISODate(Number(iso[1]), Number(iso[2]), Number(iso[3]))

  const slash = clean.match(SLASH_DATE)
  if (slash) {
    const [first, second, year] = [Number(slash[1]), Number(slash[2]), Number(slash[3])]
    return order === 'MDY' ? toISODate(year, first, second) : toISODate(year, second, first)
  }

  const dayMonYear = clean.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/)
  if (dayMonYear) {
    const month = SHORT_MONTHS[dayMonYear[2].toLowerCase()]
    if (month) return toISODate(Number(dayMonYear[3]), month, Number(dayMonYear[1]))
  }

  const monDayYear = clean.match(/^([A-Za-z]{3})\s+(\d{1,2}),?\s*(\d{4})$/)
  if (monDayYear) {
    const month = SHORT_MONTHS[monDayYear[1].toLowerCase()]
    if (month) return toISODate(Number(monDayYear[3]), month, Number(monDayYear[2]))
  }

  return null
}

/**
 * Which order the file's slash dates must be in: a first part over 12 can only
 * be a day (D/M/Y), a second part over 12 only a day (M/D/Y). 'either' when
 * nothing decides it, or when the file contradicts itself.
 */
export function detectDateOrder(values: string[]): DateOrder | 'either' {
  let dayFirst = false
  let monthFirst = false
  for (const value of values) {
    const slash = value.trim().match(SLASH_DATE)
    if (!slash) continue
    if (Number(slash[1]) > 12) dayFirst = true
    if (Number(slash[2]) > 12) monthFirst = true
  }
  if (dayFirst && !monthFirst) return 'DMY'
  if (monthFirst && !dayFirst) return 'MDY'
  return 'either'
}

/** An amount cell as a number: empty or "-" is 0, anything non-numeric is null. */
export function parseAmount(value: string): number | null {
  const cleaned = value.replace(/[,₱$\s]/g, '').replace(/^\((.+)\)$/, '-$1')
  if (cleaned === '' || cleaned === '-') return 0
  const amount = Number(cleaned)
  return Number.isFinite(amount) ? amount : null
}

function isBalanceLine(description: string): boolean {
  const lower = description.toLowerCase()
  return (
    lower.includes('beg balance') ||
    lower.includes('beginning balance') ||
    lower.includes('end balance') ||
    lower.includes('opening balance')
  )
}

/**
 * Every data row after the header, flagged rather than dropped. Only balance
 * lines and zero-amount lines are left out, and they're counted in `ignored`.
 */
export function buildRows(
  raw: string[][],
  headerIdx: number,
  format: BankFormat,
  dateOrder: DateOrder,
): { rows: ImportRow[]; ignored: number } {
  const headers = raw[headerIdx].map((cell) => cell.toLowerCase().trim())
  const col = (terms: string[]) => headers.findIndex((header) => terms.some((term) => header.includes(term)))

  const dateIdx = col(['transaction date', 'post date', 'date'])
  const descIdx = col(['description', 'remarks', 'particulars', 'details', 'memo', 'narration'])
  const amountIdx = col(['amount'])
  const debitIdx = col(['debit amount', 'debit'])
  const creditIdx = col(['credit amount', 'credit'])
  const signedAmount = format === 'BPI' || (format === 'Generic' && amountIdx >= 0)

  const rows: ImportRow[] = []
  let ignored = 0

  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i]
    if (!row.length || row.every((cell) => !cell)) continue

    const rawDesc = descIdx >= 0 ? (row[descIdx] ?? '') : (row[1] ?? '')
    const description = rawDesc.replace(/^"|"$/g, '').trim()
    if (isBalanceLine(description)) {
      ignored++
      continue
    }

    const issues: CauseId[] = []
    let amount: number | null
    let type: ImportRow['type'] = null
    let rawAmount: string

    if (signedAmount) {
      rawAmount = row[amountIdx] ?? ''
      const value = parseAmount(rawAmount)
      amount = value === null ? null : Math.abs(value)
      if (value !== null && value !== 0) type = value < 0 ? 'expense' : 'income'
    } else {
      const rawDebit = debitIdx >= 0 ? (row[debitIdx] ?? '') : ''
      const rawCredit = creditIdx >= 0 ? (row[creditIdx] ?? '') : ''
      const debit = parseAmount(rawDebit)
      const credit = parseAmount(rawCredit)
      rawAmount = debit === null ? rawDebit : credit === null ? rawCredit : rawDebit || rawCredit
      if (debit === null || credit === null) {
        amount = null
      } else if (debit > 0) {
        amount = debit
        type = 'expense'
      } else if (credit > 0) {
        amount = credit
        type = 'income'
      } else {
        amount = 0
      }
    }

    if (amount === 0) {
      ignored++
      continue
    }
    if (amount === null) issues.push('bad-amount')

    const rawDate = dateIdx >= 0 ? (row[dateIdx] ?? '') : ''
    const date = parseDate(rawDate, dateOrder)
    if (!date) issues.push('bad-date')
    if (!description) issues.push('empty-description')

    rows.push({ line: i - headerIdx, rawDate, rawAmount, date, description, amount, type, issues })
  }

  return { rows, ignored }
}

export function processFile(text: string): ParsedFile | { error: string } {
  let raw: string[][]
  try {
    raw = parseCSVText(text)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not parse this CSV file.' }
  }

  if (raw.length < 2) {
    return { error: 'File appears to be empty or has no data rows.' }
  }

  const headerIdx = findHeaderRowIndex(raw)
  if (headerIdx < 0) {
    return {
      error:
        'Could not detect a valid header row. Make sure this is a bank CSV export with columns like Date, Description, Debit, or Credit.',
    }
  }

  const format = detectFormat(raw[headerIdx])
  const headers = raw[headerIdx].map((cell) => cell.toLowerCase().trim())
  const dateIdx = headers.findIndex((header) => ['transaction date', 'post date', 'date'].some((term) => header.includes(term)))
  const detected = dateIdx >= 0 ? detectDateOrder(raw.slice(headerIdx + 1).map((row) => row[dateIdx] ?? '')) : 'either'
  const dateOrder: DateOrder = detected === 'either' ? 'MDY' : detected

  const { rows } = buildRows(raw, headerIdx, format, dateOrder)
  if (rows.length === 0) {
    return { error: 'No valid transactions found in the file.' }
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    return {
      error: `This file contains ${rows.length} rows. The current import limit is ${MAX_IMPORT_ROWS} rows to keep the app responsive.`,
    }
  }

  return { format, raw, headerIdx, dateOrder }
}

/** A row's parse issues plus `duplicate` when the check matched it. */
export function rowIssues(row: ImportRow, duplicates: ReadonlySet<number> | ReadonlyMap<number, unknown>): CauseId[] {
  return duplicates.has(row.line) ? [...row.issues, 'duplicate'] : row.issues
}

function hasError(issues: CauseId[]): boolean {
  return issues.some((id) => CAUSES[id].severity === 'error')
}

export interface Cause {
  id: CauseId
  label: string
  severity: Severity
  lines: number[]
  /** The first affected row's raw value, to show what the fix applies to. */
  sample: string
}

/** Problems grouped by cause, errors first; causes with no rows are left out. */
export function groupProblems(
  rows: ImportRow[],
  duplicates: ReadonlySet<number> | ReadonlyMap<number, unknown>,
): Cause[] {
  const byCause = new Map<CauseId, ImportRow[]>()
  for (const row of rows) {
    for (const id of rowIssues(row, duplicates)) {
      const list = byCause.get(id)
      if (list) list.push(row)
      else byCause.set(id, [row])
    }
  }
  return CAUSE_ORDER.filter((id) => byCause.has(id)).map((id) => {
    const affected = byCause.get(id)!
    const first = affected[0]
    return {
      id,
      ...CAUSES[id],
      lines: affected.map((row) => row.line),
      sample: id === 'bad-date' ? first.rawDate : id === 'bad-amount' ? first.rawAmount : first.description,
    }
  })
}

/** How many of the file's unparseable dates would parse in the other order. */
export function fixableByOtherOrder(rows: ImportRow[], order: DateOrder): number {
  const other: DateOrder = order === 'MDY' ? 'DMY' : 'MDY'
  return rows.filter((row) => row.issues.includes('bad-date') && parseDate(row.rawDate, other) !== null).length
}

export interface ImportSelection {
  duplicates: ReadonlySet<number> | ReadonlyMap<number, unknown>
  /** Causes the user chose to skip: every row under them stays out. */
  skipped: ReadonlySet<CauseId>
  /**
   * Rows the user flipped from their default (LED-75): a duplicate ticked in,
   * or any other row ticked out. Rows with an error can't be selected.
   */
  toggled: ReadonlySet<number>
}

type RowState = 'skipped' | 'error' | 'deselected' | 'ready'

function rowState(row: ImportRow, selection: ImportSelection): RowState {
  const issues = rowIssues(row, selection.duplicates)
  if (issues.some((id) => selection.skipped.has(id))) return 'skipped'
  if (hasError(issues)) return 'error'
  const selectedByDefault = !issues.includes('duplicate')
  return selectedByDefault !== selection.toggled.has(row.line) ? 'ready' : 'deselected'
}

export interface ImportSummary {
  /** Rows that will be written: the Import button's count. */
  ready: number
  /** Rows with an unresolved error. Any at all blocks the import. */
  errors: number
  /** Rows with a warning; they import anyway unless their cause is skipped. */
  warnings: number
  /** Rows matching an existing transaction, ticked or not. */
  duplicates: number
  skipped: number
  /** Rows the user can tick but hasn't. */
  deselected: number
  /** The deselected rows that are duplicates. */
  excludedDuplicates: number
}

export function summarise(rows: ImportRow[], selection: ImportSelection): ImportSummary {
  const summary: ImportSummary = {
    ready: 0,
    errors: 0,
    warnings: 0,
    duplicates: 0,
    skipped: 0,
    deselected: 0,
    excludedDuplicates: 0,
  }
  for (const row of rows) {
    const issues = rowIssues(row, selection.duplicates)
    const duplicate = issues.includes('duplicate')
    if (duplicate) summary.duplicates++
    if (issues.some((id) => CAUSES[id].severity === 'warning')) summary.warnings++
    const state = rowState(row, selection)
    if (state === 'ready') summary.ready++
    else if (state === 'error') summary.errors++
    else if (state === 'skipped') summary.skipped++
    else {
      summary.deselected++
      if (duplicate) summary.excludedDuplicates++
    }
  }
  return summary
}

/** The rows to write, or none at all while any error is unresolved. */
export function importableRows(rows: ImportRow[], selection: ImportSelection): ImportRow[] {
  if (rows.some((row) => rowState(row, selection) === 'error')) return []
  return rows.filter((row) => rowState(row, selection) === 'ready')
}

export function isSkipped(row: ImportRow, selection: ImportSelection): boolean {
  return rowState(row, selection) === 'skipped'
}

/** Whether the row has a checkbox: not under a skipped cause and error-free. */
export function isSelectable(row: ImportRow, selection: ImportSelection): boolean {
  const state = rowState(row, selection)
  return state === 'ready' || state === 'deselected'
}

export function isSelected(row: ImportRow, selection: ImportSelection): boolean {
  return rowState(row, selection) === 'ready'
}

/** The toggles that tick (or untick) every selectable row, leaving the rest alone. */
export function selectAll(rows: ImportRow[], selection: ImportSelection, value: boolean): Set<number> {
  const next = new Set(selection.toggled)
  for (const row of rows) {
    if (!isSelectable(row, selection)) continue
    const selectedByDefault = !rowIssues(row, selection.duplicates).includes('duplicate')
    if (selectedByDefault === value) next.delete(row.line)
    else next.add(row.line)
  }
  return next
}

/** Errors, then duplicates, then warnings, then clean rows; file order within each. */
export function sortProblemsFirst(
  rows: ImportRow[],
  duplicates: ReadonlySet<number> | ReadonlyMap<number, unknown>,
): ImportRow[] {
  const rank = (row: ImportRow) => {
    const issues = rowIssues(row, duplicates)
    if (hasError(issues)) return 0
    if (issues.includes('duplicate')) return 1
    if (issues.length > 0) return 2
    return 3
  }
  return rows
    .map((row) => ({ row, rank: rank(row) }))
    .sort((a, b) => a.rank - b.rank || a.row.line - b.row.line)
    .map(({ row }) => row)
}

export function isProblem(row: ImportRow, duplicates: ReadonlySet<number> | ReadonlyMap<number, unknown>): boolean {
  return rowIssues(row, duplicates).length > 0
}
