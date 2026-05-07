import type { Account } from '@/types'

export interface BalanceSummary {
  totalAssets: number
  totalCreditCardDebt: number
  netWorth: number
}

export function getCreditCardSpending(account: Account): number {
  if (account.type !== 'credit_card') return 0
  // Credit card balance is stored as a liability:
  //   0 = nothing owed
  //  -4000 = you currently owe 4,000
  // Spending / utilization should treat "how much you owe" as a positive number.
  return Math.max(0, -account.balance)
}

export function getCreditCardNetWorthContribution(account: Account): number {
  // Net worth sums account balances directly.
  // For credit cards, balance is negative (liability) so it subtracts from net worth.
  return account.balance
}

export function getAccountAssetBalance(account: Account): number {
  if (account.type === 'credit_card') {
    // A positive credit-card balance means an overpayment/statement credit.
    // Debt is tracked separately so it never inflates the asset total.
    return Math.max(0, account.balance)
  }
  return Math.max(0, account.balance)
}

export function getAccountNetWorthContribution(account: Account): number {
  return account.type === 'credit_card'
    ? getCreditCardNetWorthContribution(account)
    : account.balance
}

export function getBalanceSummary(accounts: Account[]): BalanceSummary {
  return accounts.reduce<BalanceSummary>(
    (summary, account) => {
      summary.totalAssets += getAccountAssetBalance(account)
      summary.totalCreditCardDebt += getCreditCardSpending(account)
      summary.netWorth += getAccountNetWorthContribution(account)
      return summary
    },
    { totalAssets: 0, totalCreditCardDebt: 0, netWorth: 0 },
  )
}

export function normalizeCreditCardBalanceForStorage<T extends { type: string; balance: number }>(values: T): T {
  if (values.type !== 'credit_card' || values.balance <= 0) return values
  return { ...values, balance: -values.balance }
}

export function getCreditCardAvailableCredit(account: Account): number {
  if (account.type !== 'credit_card' || account.credit_limit == null) return 0
  // balance is negative when you owe money:
  //   available = credit_limit - owed
  //            = credit_limit - (-balance)
  //            = credit_limit + balance
  return Math.max(0, account.credit_limit + account.balance)
}

export function getCreditUtilizationPct(account: Account): number {
  if (account.type !== 'credit_card' || !account.credit_limit || account.credit_limit <= 0) return 0
  return Math.max(0, Math.min((getCreditCardSpending(account) / account.credit_limit) * 100, 999))
}

export function daysUntilDayOfMonth(day: number | null | undefined): number | null {
  if (!day || day < 1 || day > 31) return null

  const today = new Date()
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  const thisMonthDate = new Date(now.getFullYear(), now.getMonth(), Math.min(day, getDaysInMonth(now.getFullYear(), now.getMonth())))
  if (thisMonthDate >= now) {
    return Math.round((thisMonthDate.getTime() - now.getTime()) / 86400000)
  }

  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const nextMonthDate = new Date(
    nextMonth.getFullYear(),
    nextMonth.getMonth(),
    Math.min(day, getDaysInMonth(nextMonth.getFullYear(), nextMonth.getMonth()))
  )
  return Math.round((nextMonthDate.getTime() - now.getTime()) / 86400000)
}

function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate()
}
