// The account, category and budget files of the data export (LED-143), beside the transactions file.
// Same cell rules as the transactions export: formula-looking text is neutralised (escapeCsvCell),
// and file names use the local date, since toISOString() is UTC and names the file after yesterday
// before 8am in Manila (LED-89).
import { escapeCsvCell } from './transactionCsv.ts'

type Cell = string | number | boolean | null | undefined

interface ExportAccount {
  name: string
  type: string
  currency: string
  balance: number
  is_active: boolean
  credit_limit: number | null
  statement_day?: number | null
  due_day?: number | null
  statement_balance?: number | null
  statement_paid_amount?: number | null
  loan_pay_period?: string | null
  notes: string | null
}

interface ExportCategory {
  name: string
  type: string
  is_default: boolean
}

interface ExportBudget {
  name: string
  category?: { name: string } | null
  amount: number
  currency: string
  period: string
  start_date: string
  end_date: string | null
  is_active: boolean
  rollover_enabled: boolean
}

const cell = (value: Cell) => (typeof value === 'boolean' ? (value ? 'yes' : 'no') : (value ?? ''))

function toCsv(headers: string[], rows: Cell[][]): string {
  return [headers, ...rows.map((row) => row.map(cell))].map((row) => row.map(escapeCsvCell).join(',')).join('\n')
}

export const ACCOUNT_CSV_HEADERS = [
  'Name', 'Type', 'Currency', 'Balance', 'Active', 'Credit Limit', 'Statement Day', 'Due Day',
  'Statement Balance', 'Statement Paid', 'Loan Pay Period', 'Notes',
]

export function buildAccountsCsv(accounts: readonly ExportAccount[]): string {
  return toCsv(
    ACCOUNT_CSV_HEADERS,
    accounts.map((a) => [
      a.name, a.type, a.currency, a.balance, a.is_active, a.credit_limit, a.statement_day, a.due_day,
      a.statement_balance, a.statement_paid_amount, a.loan_pay_period, a.notes,
    ]),
  )
}

export const CATEGORY_CSV_HEADERS = ['Name', 'Type', 'Default']

export function buildCategoriesCsv(categories: readonly ExportCategory[]): string {
  return toCsv(CATEGORY_CSV_HEADERS, categories.map((c) => [c.name, c.type, c.is_default]))
}

export const BUDGET_CSV_HEADERS = [
  'Name', 'Category', 'Amount', 'Currency', 'Period', 'Start Date', 'End Date', 'Active', 'Rollover',
]

export function buildBudgetsCsv(budgets: readonly ExportBudget[]): string {
  return toCsv(
    BUDGET_CSV_HEADERS,
    budgets.map((b) => [
      b.name, b.category?.name, b.amount, b.currency, b.period, b.start_date, b.end_date, b.is_active, b.rollover_enabled,
    ]),
  )
}

export type ExportKind = 'transactions' | 'accounts' | 'categories' | 'budgets'

/** `ledger-export_accounts_2026-09-26.csv`; `localDate` is a local YYYY-MM-DD. */
export function exportFileName(kind: ExportKind, localDate: string): string {
  return `ledger-export_${kind}_${localDate}.csv`
}
