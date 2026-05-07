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
  created_at: string
  updated_at: string
}

export interface Subcategory {
  id: string
  user_id: string
  category_id: string
  name: string
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
  description: string
  notes: string | null
  date: string
  transfer_fee: number | null
  is_recurring: boolean
  recurrence_interval: RecurrenceInterval | null
  recurrence_end_date: string | null
  receipt_url: string | null
  tags?: string[]
  goal_id?: string | null
  created_at: string
  updated_at: string
  // joined
  account?: Account
  to_account?: Account
  category?: Category
  subcategory?: Subcategory
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
  rollover_amount?: number
  effective_amount?: number
  history?: BudgetHistoryEntry[]
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
  created_at: string
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

export const ACCOUNT_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#06b6d4',
]
