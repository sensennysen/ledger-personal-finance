import type { Account, LoanPaymentAllocation, LoanPurchase } from '@/types'
import { daysUntilDayOfMonth, getCreditCardSpending, getCreditUtilizationPct } from './creditCards.ts'
import { getLoanAmountOwed } from './loans.ts'
import { getLoanDeadlines, getPurchaseInstallments, roundMoney } from './loanInstallments.ts'

// The Accounts page compares assets with liabilities (LED-76). There is no
// exchange-rate table, so totals only count accounts in the base currency and
// every other account is marked excluded on its own row.

export interface LoanProgress {
  paidInstallments: number
  totalInstallments: number
  totalPaid: number
  totalPayable: number
  pct: number
}

export interface AssetRow {
  account: Account
  balance: number
  /** Share of the asset total, 0–100; null when the account is excluded. */
  sharePct: number | null
  excluded: boolean
}

export interface LiabilityRow {
  account: Account
  owed: number
  excluded: boolean
  utilizationPct: number | null
  loanProgress: LoanProgress | null
}

export interface ComingUpItem {
  account: Account
  label: string
  amount: number
  /** Days from today; negative when overdue. */
  days: number
}

export interface AccountsOverview {
  assets: AssetRow[]
  liabilities: LiabilityRow[]
  totals: { assets: number; liabilities: number; netWorth: number }
  excludedCurrencies: string[]
  comingUp: ComingUpItem[]
}

export function isLiability(account: Pick<Account, 'type'>): boolean {
  return account.type === 'credit_card' || account.type === 'loan'
}

export function loanProgress(purchases: LoanPurchase[], allocations: LoanPaymentAllocation[]): LoanProgress | null {
  if (purchases.length === 0) return null
  let paidInstallments = 0
  let totalInstallments = 0
  let totalPaid = 0
  let totalPayable = 0
  for (const purchase of purchases) {
    const installments = getPurchaseInstallments(purchase, allocations)
    totalInstallments += installments.length
    paidInstallments += installments.filter((item) => item.remainingAmount <= 0).length
    totalPayable += purchase.total_payable
    totalPaid += installments.reduce((sum, item) => sum + item.scheduledAmount - item.remainingAmount, 0)
  }
  return {
    paidInstallments,
    totalInstallments,
    totalPaid: roundMoney(totalPaid),
    totalPayable: roundMoney(totalPayable),
    pct: totalPayable > 0 ? Math.min(100, (totalPaid / totalPayable) * 100) : 0,
  }
}

export function daysUntilDate(date: string, today: Date): number {
  const [year, month, day] = date.split('-').map(Number)
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((new Date(year, month - 1, day).getTime() - start.getTime()) / 86400000)
}

/** What the next card payment asks for: the unpaid statement, else what's owed. */
export function cardAmountDue(account: Account): number {
  if (account.statement_balance != null) {
    return roundMoney(Math.max(0, account.statement_balance - (account.statement_paid_amount ?? 0)))
  }
  return getCreditCardSpending(account)
}

export function buildAccountsOverview(
  accounts: Account[],
  baseCurrency: string,
  loans: { purchases: LoanPurchase[]; allocations: LoanPaymentAllocation[] } = { purchases: [], allocations: [] },
  today: Date = new Date(),
): AccountsOverview {
  const counted = (account: Account) => account.currency === baseCurrency
  const assetAccounts = accounts.filter((account) => !isLiability(account))
  const liabilityAccounts = accounts.filter(isLiability)

  const totalAssets = roundMoney(
    assetAccounts.filter(counted).reduce((sum, account) => sum + Math.max(0, account.balance), 0),
  )
  const assets = assetAccounts.map((account) => ({
    account,
    balance: account.balance,
    excluded: !counted(account),
    sharePct: counted(account) && totalAssets > 0 ? (Math.max(0, account.balance) / totalAssets) * 100 : counted(account) ? 0 : null,
  }))

  const comingUp: ComingUpItem[] = []
  const liabilities = liabilityAccounts.map((account) => {
    if (account.type === 'credit_card') {
      const due = daysUntilDayOfMonth(account.due_day, today)
      const amount = cardAmountDue(account)
      if (due !== null && amount > 0) comingUp.push({ account, label: `${account.name} payment`, amount, days: due })
      return {
        account,
        owed: getCreditCardSpending(account),
        excluded: !counted(account),
        utilizationPct: account.credit_limit ? getCreditUtilizationPct(account) : null,
        loanProgress: null,
      }
    }
    const purchases = loans.purchases.filter((purchase) => purchase.account_id === account.id)
    const next = getLoanDeadlines(purchases, loans.allocations)[0]
    if (next) comingUp.push({ account, label: `${account.name} installment`, amount: next.total, days: daysUntilDate(next.dueDate, today) })
    return {
      account,
      owed: getLoanAmountOwed(account),
      excluded: !counted(account),
      utilizationPct: null,
      loanProgress: loanProgress(purchases, loans.allocations),
    }
  })

  const totalLiabilities = roundMoney(
    liabilities.filter((row) => !row.excluded).reduce((sum, row) => sum + row.owed, 0),
  )
  // Net worth sums signed balances, so a card in credit adds to it (see creditCards.ts).
  const netWorth = roundMoney(accounts.filter(counted).reduce((sum, account) => sum + account.balance, 0))

  return {
    assets,
    liabilities,
    totals: { assets: totalAssets, liabilities: totalLiabilities, netWorth },
    excludedCurrencies: [...new Set(accounts.filter((account) => !counted(account)).map((account) => account.currency))].sort(),
    comingUp: comingUp.sort((left, right) => left.days - right.days),
  }
}

/** "65%", "<1%", or "0%" for the share column. */
export function formatShare(pct: number): string {
  if (pct > 0 && pct < 1) return '<1%'
  return `${Math.round(pct)}%`
}
