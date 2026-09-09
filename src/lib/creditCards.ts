import type { Account } from '@/types'
import { getLoanAmountOwed, normalizeLiabilityBalanceForStorage } from '@/lib/loans'
import { convertAmount, type RateMap } from '@/lib/currency'

export interface BalanceSummary {
  totalAssets: number
  totalCreditCardDebt: number
  totalLoanDebt: number
  netWorth: number
}

export interface BalanceSummaryOptions {
  /** Currency every figure in the summary should be expressed in. */
  displayCurrency: string
  /** USD-anchored rate map (see src/lib/currency.ts). */
  rates: RateMap
}

export type BalanceSummaryResult = BalanceSummary & {
  /** Currencies that had no rate and were left out of the totals. */
  excludedCurrencies: string[]
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
  if (account.type === 'credit_card' || account.type === 'loan') {
    // A positive credit-card balance means an overpayment/statement credit.
    // Debt is tracked separately so it never inflates the asset total.
    return Math.max(0, account.balance)
  }
  return Math.max(0, account.balance)
}

export function getAccountNetWorthContribution(account: Account): number {
  return account.type === 'credit_card' || account.type === 'loan'
    ? getCreditCardNetWorthContribution(account)
    : account.balance
}

/**
 * Roll account balances up into a single summary. Pass `options` to express
 * every figure in one display currency; accounts whose currency has no rate are
 * excluded from the totals and reported in `excludedCurrencies`. Without
 * `options` the raw balances are summed as-is (legacy, single-currency) behaviour.
 */
export function getBalanceSummary(
  accounts: Account[],
  options?: BalanceSummaryOptions,
): BalanceSummaryResult {
  const excluded = new Set<string>()

  const conv = (value: number, currency: string): number | null => {
    if (!options || value === 0) return value
    const converted = convertAmount(value, currency, options.displayCurrency, options.rates)
    if (converted === null) excluded.add(currency)
    return converted
  }

  const summary: BalanceSummary = {
    totalAssets: 0,
    totalCreditCardDebt: 0,
    totalLoanDebt: 0,
    netWorth: 0,
  }

  for (const account of accounts) {
    const asset = conv(getAccountAssetBalance(account), account.currency)
    if (asset !== null) summary.totalAssets += asset

    const ccDebt = conv(getCreditCardSpending(account), account.currency)
    if (ccDebt !== null) summary.totalCreditCardDebt += ccDebt

    const loanDebt = conv(getLoanAmountOwed(account), account.currency)
    if (loanDebt !== null) summary.totalLoanDebt += loanDebt

    const netWorth = conv(getAccountNetWorthContribution(account), account.currency)
    if (netWorth !== null) summary.netWorth += netWorth
  }

  return { ...summary, excludedCurrencies: [...excluded] }
}

export function normalizeCreditCardBalanceForStorage<T extends { type: string; balance: number }>(values: T): T {
  return normalizeLiabilityBalanceForStorage(values)
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
