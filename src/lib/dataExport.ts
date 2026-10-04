// The account, category, budget and (LED-180) savings goal, loan purchase/allocation and
// transaction rule files of the data export, beside the transactions file. Same cell rules as
// the transactions export: formula-looking text is neutralised (escapeCsvCell), and file names
// use the local date, since toISOString() is UTC and names the file after yesterday before
// 8am in Manila (LED-89).
import { WEEKDAY_LABELS } from './loans.ts'
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
  loan_due_days?: number[] | null
  loan_due_weekday?: number | null
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
  /** This cycle's converted spend (LED-186). */
  spent: number
  /** Currencies left out of `spent` for having no exchange rate. */
  unrated_currencies: string[]
}

const cell = (value: Cell) => (typeof value === 'boolean' ? (value ? 'yes' : 'no') : (value ?? ''))

function toCsv(headers: string[], rows: Cell[][]): string {
  return [headers, ...rows.map((row) => row.map(cell))].map((row) => row.map(escapeCsvCell).join(',')).join('\n')
}

export const ACCOUNT_CSV_HEADERS = [
  'Name', 'Type', 'Currency', 'Balance', 'Active', 'Credit Limit', 'Statement Day', 'Due Day',
  'Statement Balance', 'Statement Paid', 'Loan Pay Period', 'Loan Due Days', 'Notes',
]

/** `loan_due_weekday` for a weekly loan, else `loan_due_days` joined (LED-181 item, OD-8). */
function loanDueDaysCell(a: ExportAccount): string {
  if (a.loan_due_weekday != null) return WEEKDAY_LABELS[a.loan_due_weekday]
  return a.loan_due_days?.join(';') ?? ''
}

export function buildAccountsCsv(accounts: readonly ExportAccount[]): string {
  return toCsv(
    ACCOUNT_CSV_HEADERS,
    accounts.map((a) => [
      a.name, a.type, a.currency, a.balance, a.is_active, a.credit_limit, a.statement_day, a.due_day,
      a.statement_balance, a.statement_paid_amount, a.loan_pay_period, loanDueDaysCell(a), a.notes,
    ]),
  )
}

export const CATEGORY_CSV_HEADERS = ['Name', 'Type', 'Default']

export function buildCategoriesCsv(categories: readonly ExportCategory[]): string {
  return toCsv(CATEGORY_CSV_HEADERS, categories.map((c) => [c.name, c.type, c.is_default]))
}

export const BUDGET_CSV_HEADERS = [
  'Name', 'Category', 'Amount', 'Currency', 'Period', 'Start Date', 'End Date', 'Active', 'Rollover', 'Spent', 'Unrated Currencies',
]

export function buildBudgetsCsv(budgets: readonly ExportBudget[]): string {
  return toCsv(
    BUDGET_CSV_HEADERS,
    budgets.map((b) => [
      b.name, b.category?.name, b.amount, b.currency, b.period, b.start_date, b.end_date, b.is_active, b.rollover_enabled,
      b.spent, b.unrated_currencies.join(';'),
    ]),
  )
}

interface ExportSavingsGoal {
  name: string
  target_amount: number
  current_amount: number
  currency: string
  deadline: string | null
  is_completed: boolean
  notes: string | null
}

export const SAVINGS_GOAL_CSV_HEADERS = ['Name', 'Target Amount', 'Current Amount', 'Currency', 'Deadline', 'Completed', 'Notes']

export function buildSavingsGoalsCsv(goals: readonly ExportSavingsGoal[]): string {
  return toCsv(
    SAVINGS_GOAL_CSV_HEADERS,
    goals.map((g) => [g.name, g.target_amount, g.current_amount, g.currency, g.deadline, g.is_completed, g.notes]),
  )
}

interface ExportLoanPurchase {
  name: string
  account?: { name: string } | null
  category?: { name: string } | null
  principal_amount: number
  term_months: number
  monthly_interest_rate: number
  monthly_installment: number
  total_payable: number
  opening_installments_paid: number
  opening_paid_amount: number
  first_due_date: string
  notes: string | null
}

export const LOAN_PURCHASE_CSV_HEADERS = [
  'Name', 'Account', 'Category', 'Principal', 'Term Months', 'Monthly Rate', 'Monthly Installment',
  'Total Payable', 'Opening Installments Paid', 'Opening Paid Amount', 'First Due Date', 'Notes',
]

export function buildLoanPurchasesCsv(purchases: readonly ExportLoanPurchase[]): string {
  return toCsv(
    LOAN_PURCHASE_CSV_HEADERS,
    purchases.map((p) => [
      p.name, p.account?.name, p.category?.name, p.principal_amount, p.term_months, p.monthly_interest_rate,
      p.monthly_installment, p.total_payable, p.opening_installments_paid, p.opening_paid_amount, p.first_due_date, p.notes,
    ]),
  )
}

interface ExportLoanAllocation {
  loanPurchase?: { name: string } | null
  transaction?: { date: string; description: string } | null
  amount: number
}

export const LOAN_ALLOCATION_CSV_HEADERS = ['Loan Purchase', 'Transaction Date', 'Transaction Description', 'Amount']

export function buildLoanAllocationsCsv(allocations: readonly ExportLoanAllocation[]): string {
  return toCsv(
    LOAN_ALLOCATION_CSV_HEADERS,
    allocations.map((a) => [a.loanPurchase?.name, a.transaction?.date, a.transaction?.description, a.amount]),
  )
}

interface ExportTransactionRule {
  keyword: string
  category?: { name: string } | null
  type_hint: string | null
  priority: number
}

export const TRANSACTION_RULE_CSV_HEADERS = ['Keyword', 'Category', 'Type Hint', 'Priority']

export function buildTransactionRulesCsv(rules: readonly ExportTransactionRule[]): string {
  return toCsv(TRANSACTION_RULE_CSV_HEADERS, rules.map((r) => [r.keyword, r.category?.name, r.type_hint, r.priority]))
}

interface ExportSubcategory {
  name: string
  category?: { name: string } | null
}

export const SUBCATEGORY_CSV_HEADERS = ['Category', 'Name']

export function buildSubcategoriesCsv(subcategories: readonly ExportSubcategory[]): string {
  return toCsv(SUBCATEGORY_CSV_HEADERS, subcategories.map((s) => [s.category?.name, s.name]))
}

interface ExportCreditCardPayment {
  account?: { name: string } | null
  amount: number
  payment_date: string
  notes: string | null
}

export const CREDIT_CARD_PAYMENT_CSV_HEADERS = ['Account', 'Amount', 'Payment Date', 'Notes']

export function buildCreditCardPaymentsCsv(payments: readonly ExportCreditCardPayment[]): string {
  return toCsv(
    CREDIT_CARD_PAYMENT_CSV_HEADERS,
    payments.map((p) => [p.account?.name, p.amount, p.payment_date, p.notes]),
  )
}

interface ExportExchangeRate {
  currency: string
  rate: number
  source: 'base' | 'feed' | 'override'
  asOf: string | null
}

export const EXCHANGE_RATE_CSV_HEADERS = ['Currency', 'Rate', 'Source', 'As Of']

export function buildExchangeRatesCsv(rates: readonly ExportExchangeRate[]): string {
  return toCsv(EXCHANGE_RATE_CSV_HEADERS, rates.map((r) => [r.currency, r.rate, r.source, r.asOf]))
}

export type ExportKind =
  | 'transactions' | 'accounts' | 'categories' | 'budgets'
  | 'savings-goals' | 'loan-purchases' | 'loan-allocations' | 'transaction-rules'
  | 'subcategories' | 'credit-card-payments' | 'exchange-rates'

/** `ledger-export_accounts_2026-09-26.csv`; `localDate` is a local YYYY-MM-DD. */
export function exportFileName(kind: ExportKind, localDate: string): string {
  return `ledger-export_${kind}_${localDate}.csv`
}
