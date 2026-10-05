import { SWATCHES } from '../lib/swatches.ts'

export type AccountType =
  | 'cash'
  | 'digital_wallet'
  | 'credit_card'
  | 'savings'
  | 'checking'
  | 'investment'
  | 'loan'
  | 'other'

export type TransactionType = 'income' | 'expense' | 'transfer'

export type LoanPayPeriod =
  | 'monthly'
  | 'twice_monthly'
  | 'weekly'
  | 'daily'
  | 'quarterly'
  | 'bi_yearly'
  | 'yearly'

export type RecurrenceInterval =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  default_currency: string
  month_start_day: number
  budget_deficit_behaviour?: 'carry' | 'reset' | null
  exchange_rate_refresh?: 'open' | 'daily' | 'weekly' | 'manual' | null
  dashboard_widget_order?: string[] | null
  /** The Home widgets turned off; null until the account stores one (LED-264). */
  dashboard_hidden_widgets?: string[] | null
  account_group_order?: AccountType[] | null
  account_view_mode?: 'all' | AccountType | null
  /** Only the preferences the user changed; read through parsePreferences (LED-263). */
  preferences?: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface Account {
  id: string
  user_id: string
  name: string
  type: AccountType
  currency: string
  balance: number
  color: string
  icon: string | null
  is_active: boolean
  credit_limit: number | null
  statement_day?: number | null
  due_day?: number | null
  utilization_target_pct?: number | null
  payment_reminder_days?: number | null
  statement_balance?: number | null
  statement_balance_locked_at?: string | null
  statement_paid_amount?: number | null
  last_payment_amount?: number | null
  last_payment_date?: string | null
  loan_pay_period?: LoanPayPeriod | null
  loan_due_days?: number[] | null
  loan_due_weekday?: number | null
  sort_order?: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  type: TransactionType | 'both'
  color: string
  icon: string
  is_default: boolean
  /** Counts as basic salary on the 13th Month page (LED-236). */
  counts_as_salary: boolean
  sort_order?: number
  created_at: string
  updated_at: string
}

export interface Subcategory {
  id: string
  user_id: string
  category_id: string
  name: string
  sort_order?: number
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  user_id: string
  account_id: string
  to_account_id: string | null
  category_id: string | null
  subcategory_id: string | null
  type: TransactionType
  amount: number
  currency: string
  exchange_rate: number
  /**
   * What a transfer between two currencies credits its destination, in the destination's currency
   * (LED-185). Null for every other row; the destination then receives the amount itself.
   */
  destination_amount?: number | null
  description: string
  notes: string | null
  date: string
  transfer_fee: number | null
  is_recurring: boolean
  recurrence_interval: RecurrenceInterval | null
  recurrence_end_date: string | null
  /** Set by the database once this row's next occurrence is posted, on any device (LED-232). */
  recurrence_next_posted?: boolean
  receipt_url: string | null
  tags?: string[]
  goal_id?: string | null
  /** The statement amount and currency of a converted CSV import row (LED-136). */
  original_amount?: number | null
  original_currency?: string | null
  created_at: string
  updated_at: string
  // joined
  account?: Account
  to_account?: Account
  category?: Category
  subcategory?: Subcategory
  /** Client-only: set on optimistic rows queued while offline, cleared on the next successful fetch. */
  queued?: boolean
}

export interface BudgetHistoryEntry {
  period_start: string
  period_end: string
  budget_amount: number
  spent_amount: number
  rollover_in: number
  currency: string
}

export interface Budget {
  id: string
  user_id: string
  category_id: string
  name: string
  amount: number
  currency: string
  period: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  start_date: string
  end_date: string | null
  is_active: boolean
  rollover_enabled: boolean
  created_at: string
  updated_at: string
  // joined / computed
  category?: Category
  spent?: number
  /** Spend dated later in the open period: scheduled, not in `spent` yet (LED-238). */
  scheduled?: number
  unrated_currencies?: string[]
  rollover_amount?: number
  effective_amount?: number
  history?: BudgetHistoryEntry[]
  /** Spend in every closed monthly period, oldest first; lets the form replay Carried in. */
  period_spends?: number[]
}

export interface SavingsGoal {
  id: string
  user_id: string
  name: string
  target_amount: number
  current_amount: number
  currency: string
  deadline: string | null
  color: string
  icon: string
  notes: string | null
  is_completed: boolean
  created_at: string
  updated_at: string
}

export interface CreditCardPayment {
  id: string
  user_id: string
  account_id: string
  amount: number
  payment_date: string
  notes: string | null
  /** The transfer this payment came from. Null on payments made before LED-191 that could not be matched. */
  transaction_id: string | null
  created_at: string
}

export interface LoanPurchase {
  id: string
  user_id: string
  account_id: string
  category_id: string | null
  name: string
  principal_amount: number
  term_months: number
  monthly_interest_rate: number
  monthly_installment: number
  total_payable: number
  opening_installments_paid: number
  opening_paid_amount: number
  first_due_date: string
  notes: string | null
  created_at: string
  updated_at: string
  paid_amount?: number
  remaining_balance?: number
  category?: Category
}

export interface LoanPaymentAllocation {
  id: string
  user_id: string
  transaction_id: string
  loan_purchase_id: string
  amount: number
  created_at: string
  transaction?: Pick<Transaction, 'id' | 'date' | 'description'>
}

export interface DashboardStats {
  totalBalance: number
  totalIncome: number
  totalExpenses: number
  netCashFlow: number
  currency: string
}

export const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
]

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: 'Cash on Hand',
  digital_wallet: 'Digital Wallet',
  credit_card: 'Credit Card',
  savings: 'Savings Account',
  checking: 'Checking Account',
  investment: 'Investment',
  loan: 'Loan',
  other: 'Other',
}

/** The shared swatch list (src/lib/swatches.ts): accounts, budgets, categories and the accent all pick from it. */
export const ACCOUNT_COLORS: readonly string[] = SWATCHES
