import { SWATCHES } from '../lib/swatches.ts'
import type { Database, Tables } from './database.ts'

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

/**
 * An entity is its generated row (src/types/database.ts, LED-320) with text and JSON columns
 * narrowed to the values the app writes. `Loose` columns stay optional: older code builds rows
 * (optimistic inserts, previews) without them. Joined and computed fields are added per entity.
 * A read narrows its rows with `.overrideTypes<Entity[]>()`; a select with joined rows passes
 * `{ merge: false }`, since the joins carry only the columns a view shows.
 */
type Entity<T extends keyof Database['public']['Tables'], Loose extends keyof Tables<T> = never, Narrowed = unknown> =
  Omit<Tables<T>, Loose | keyof Narrowed> & Partial<Pick<Tables<T>, Exclude<Loose, keyof Narrowed>>> & Narrowed

export type Profile = Entity<
  'profiles',
  'setup_checklist_dismissed_at' | 'pay_cycle_confirmed_at',
  {
    budget_deficit_behaviour?: 'carry' | 'reset' | null
    exchange_rate_refresh?: 'open' | 'daily' | 'weekly' | 'manual' | null
    dashboard_widget_order?: string[] | null
    /** The Home widgets turned off; null until the account stores one (LED-264). */
    dashboard_hidden_widgets?: string[] | null
    account_group_order?: AccountType[] | null
    account_view_mode?: 'all' | AccountType | null
    /** Only the preferences the user changed; read through parsePreferences (LED-263). */
    preferences?: Record<string, unknown> | null
  }
>

export type Account = Entity<
  'accounts',
  | 'statement_day' | 'due_day' | 'utilization_target_pct' | 'payment_reminder_days' | 'statement_balance'
  | 'statement_balance_locked_at' | 'statement_paid_amount' | 'last_payment_amount' | 'last_payment_date'
  | 'loan_due_days' | 'loan_due_weekday' | 'sort_order' | 'loan_original_amount' | 'loan_due_day'
  | 'loan_due_day_secondary',
  {
    type: AccountType
    loan_pay_period?: LoanPayPeriod | null
  }
>

/** counts_as_salary: counts as basic salary on the 13th Month page (LED-236). */
export type Category = Entity<
  'categories',
  'sort_order',
  { type: TransactionType | 'both' }
>

export type Subcategory = Entity<'subcategories', 'sort_order'>

/**
 * destination_amount: what a transfer between two currencies credits its destination, in the
 * destination's currency (LED-185); null for every other row. recurrence_next_posted: set by the
 * database once the next occurrence is posted, on any device (LED-232). original_amount and
 * original_currency: the statement amount of a converted CSV import row (LED-136).
 */
export type Transaction = Entity<
  'transactions',
  | 'destination_amount' | 'recurrence_next_posted' | 'tags' | 'goal_id' | 'original_amount' | 'original_currency',
  {
    type: TransactionType
    recurrence_interval: RecurrenceInterval | null
    // joined
    account?: Account
    to_account?: Account
    category?: Category
    subcategory?: Subcategory
    /** Client-only: set on optimistic rows queued while offline, cleared on the next successful fetch. */
    queued?: boolean
  }
>

export interface BudgetHistoryEntry {
  period_start: string
  period_end: string
  budget_amount: number
  spent_amount: number
  rollover_in: number
  currency: string
}

export type Budget = Entity<
  'budgets',
  never,
  {
    period: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
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
>

export type SavingsGoal = Entity<'savings_goals'>

/** transaction_id: the transfer this payment came from; null on payments before LED-191 that could not be matched. */
export type CreditCardPayment = Entity<'credit_card_payments'>

export type LoanPurchase = Entity<
  'loan_purchases',
  never,
  {
    paid_amount?: number
    remaining_balance?: number
    category?: Category
  }
>

export type LoanPaymentAllocation = Entity<
  'loan_payment_allocations',
  never,
  { transaction?: Pick<Transaction, 'id' | 'date' | 'description'> }
>

/** An entity's database columns, without joined or computed fields: what an insert or update may send. */
export type Columns<T extends keyof Database['public']['Tables'], E> = Pick<E, Extract<keyof E, keyof Tables<T>>>

/** Arguments of a database function, as the generated schema declares them. */
export type RpcArgs<F extends keyof Database['public']['Functions']> = Database['public']['Functions'][F]['Args']

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
