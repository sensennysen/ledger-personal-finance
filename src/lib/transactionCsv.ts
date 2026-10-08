// Transactions as CSV (LED-89). Moved out of ReportsPage so the same exporter
// serves Reports and the data-deletion page. Formula-looking cells are
// neutralised because the file is usually opened in Excel or Sheets.
import type { Transaction } from '@/types'
import type { ReportColumn } from './reportColumns.ts'

export function escapeCsvCell(value: string | number | null | undefined): string {
  let str = String(value ?? '')
  // Neutralize spreadsheet formulas when the CSV is opened in Excel/Sheets. A number is not text a
  // formula can hide in, and a negative balance (a card, a loan) must stay a number (LED-143).
  // A leading tab or carriage return is on OWASP's list too (LED-329).
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export const TRANSACTION_CSV_HEADERS = [
  'Date',
  'Type',
  'Description',
  'Category',
  'Account',
  'To Account',
  'Amount',
  'Currency',
  'Exchange Rate',
  'Amount Received',
  'Transfer Fee',
  'Standing Balance',
  'Notes',
]

/** Standing Balance is left blank for any transaction missing from `balanceMap`. */
export function buildTransactionsCsv(
  transactions: Transaction[],
  balanceMap: Map<string, number> = new Map(),
): string {
  const rows = transactions.map((t) => [
    t.date,
    t.type,
    t.description,
    t.category?.name ?? '',
    t.account?.name ?? t.account_id,
    t.to_account?.name ?? t.to_account_id ?? '',
    t.amount,
    t.currency,
    t.exchange_rate,
    // A transfer between two currencies: what the destination received, in its currency (LED-185).
    t.destination_amount ?? '',
    t.transfer_fee ?? '',
    balanceMap.get(t.id) ?? '',
    t.notes ?? '',
  ])

  return [TRANSACTION_CSV_HEADERS, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\n')
}

// Reports' CSV follows the table's Columns choice (LED-140). Amount always brings its
// currency, since a bare number in a mixed-currency export cannot be read.
const REPORT_CSV_FIELDS: Record<
  ReportColumn,
  { headers: string[]; cells: (t: Transaction, balance: number | undefined) => (string | number)[] }
> = {
  date: { headers: ['Date'], cells: (t) => [t.date] },
  description: { headers: ['Description'], cells: (t) => [t.description] },
  category: { headers: ['Category'], cells: (t) => [t.category?.name ?? ''] },
  account: { headers: ['Account'], cells: (t) => [t.account?.name ?? t.account_id] },
  type: { headers: ['Type'], cells: (t) => [t.type] },
  amount: { headers: ['Amount', 'Currency'], cells: (t) => [t.amount, t.currency] },
  balance: { headers: ['Standing Balance'], cells: (_t, balance) => [balance ?? ''] },
}

/** Only `columns`, in the order given; Standing Balance is blank for a transaction missing from `balanceMap`. */
export function buildReportCsv(
  transactions: Transaction[],
  columns: ReportColumn[],
  balanceMap: Map<string, number> = new Map(),
): string {
  const header = columns.flatMap((column) => REPORT_CSV_FIELDS[column].headers)
  const rows = transactions.map((t) =>
    columns.flatMap((column) => REPORT_CSV_FIELDS[column].cells(t, balanceMap.get(t.id))),
  )
  return [header, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n')
}

export function downloadCsv(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
