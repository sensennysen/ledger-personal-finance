import type { Account, LoanPayPeriod } from '@/types'

export const LOAN_PAY_PERIOD_LABELS: Record<LoanPayPeriod, string> = {
  monthly: 'Once a month',
  twice_monthly: 'Twice a month',
  weekly: 'Weekly',
  daily: 'Daily',
  quarterly: 'Quarterly',
  bi_yearly: 'Bi-yearly',
  yearly: 'Yearly',
}

export const WEEKDAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

export function getLoanAmountOwed(account: Account): number {
  if (account.type !== 'loan') return 0
  return Math.max(0, -account.balance)
}

/**
 * Loan accounts that still owe something: the one definition of "how many loans", shared by
 * the search palette and the Add Transaction kind menu so the count cannot drift again
 * (LED-156). A loan repaid to zero does not count. Pass `currency` to also restrict to one
 * currency (the kind menu totals only the base currency, LED-135); omit it to count every
 * loan account regardless of currency.
 */
export function loansOwed(accounts: Account[], currency?: string): Account[] {
  return accounts.filter(
    (account) => account.type === 'loan' && (currency === undefined || account.currency === currency) && getLoanAmountOwed(account) > 0,
  )
}

export function normalizeLiabilityBalanceForStorage<T extends { type: string; balance: number }>(values: T): T {
  if ((values.type !== 'credit_card' && values.type !== 'loan') || values.balance <= 0) return values
  return { ...values, balance: -values.balance }
}

/** Days from `today` to `dueDate` (both YYYY-MM-DD), parsed at local midnight so a UTC offset cannot shift it by a day. */
export function daysUntilDue(dueDate: string, today: string): number {
  const atLocalMidnight = (date: string) => {
    const [year, month, day] = date.split('-').map(Number)
    return new Date(year, month - 1, day).getTime()
  }
  return Math.round((atLocalMidnight(dueDate) - atLocalMidnight(today)) / 86400000)
}

/** "1 day overdue" / "N days overdue", or null when `daysUntil` is not negative (LED-181 item, OD-8: the loan
 * detail page's "Next payment" had no overdue flag, unlike Home's Upcoming Bills). */
export function formatOverdue(daysUntil: number): string | null {
  if (daysUntil >= 0) return null
  return daysUntil === -1 ? '1 day overdue' : `${-daysUntil} days overdue`
}

export function formatLoanSchedule(account: Pick<Account, 'type' | 'loan_pay_period' | 'loan_due_days' | 'loan_due_weekday'>): string | null {
  if (account.type !== 'loan' || !account.loan_pay_period) return null

  const period = LOAN_PAY_PERIOD_LABELS[account.loan_pay_period]
  if (account.loan_pay_period === 'weekly' && account.loan_due_weekday != null) {
    return `${period} · ${WEEKDAY_LABELS[account.loan_due_weekday]}`
  }
  if (account.loan_pay_period === 'twice_monthly' && account.loan_due_days?.length) {
    return `${period} · days ${account.loan_due_days.join(' & ')}`
  }
  if (account.loan_pay_period !== 'daily' && account.loan_due_days?.[0]) {
    return `${period} · day ${account.loan_due_days[0]}`
  }
  return period
}
