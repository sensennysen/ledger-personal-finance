// Transactions as CSV (LED-89). Moved out of ReportsPage so the same exporter
// serves Reports and the data-deletion page. Formula-looking cells are
// neutralised because the file is usually opened in Excel or Sheets.
import type { Transaction } from '@/types'

export function escapeCsvCell(value: string | number | null | undefined): string {
  let str = String(value ?? '')
  // Neutralize spreadsheet formulas when the CSV is opened in Excel/Sheets.
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
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
    t.transfer_fee ?? '',
    balanceMap.get(t.id) ?? '',
    t.notes ?? '',
  ])

  return [TRANSACTION_CSV_HEADERS, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\n')
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
