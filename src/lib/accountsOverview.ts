import type { Account, LoanPaymentAllocation, LoanPurchase } from '@/types'
import { daysUntilDayOfMonth, getBalanceSummary, getCreditCardSpending, getCreditUtilizationPct, type BalanceSummary } from './creditCards.ts'
import { getLoanAmountOwed } from './loans.ts'
import { getLoanDeadlines, getPurchaseInstallments, roundMoney } from './loanInstallments.ts'
import type { ConvertFn } from './exchangeRates.ts'

// The Accounts page compares assets with liabilities (LED-76). Totals are in the base
// currency. An account in another currency is converted with the `convert` function the
// caller passes (LED-136: the rates from Settings); one it cannot convert is marked excluded
// on its own row and named in `excludedCurrencies`. Without `convert`, only base-currency
// accounts count. Home and Reports use `summarizeBalances` so all three screens show the
// same net worth.

export interface LoanProgress {
  paidInstallments: number
  totalInstallments: number
  totalPaid: number
  totalPayable: number
  pct: number
}

export interface AssetRow {
  account: Account
  /** In the account's own currency. */
  balance: number
  /** The balance in the base currency when the account is in another one and was converted. */
  converted: number | null
  /** Share of the asset total, 0–100; null when the account is excluded. */
  sharePct: number | null
  excluded: boolean
}

export interface LiabilityRow {
  account: Account
  owed: number
  /** What is owed in the base currency when the account is in another one and was converted. */
  convertedOwed: number | null
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
  /** Currencies counted in the totals at a converted rate. */
  convertedCurrencies: string[]
  comingUp: ComingUpItem[]
}

export interface BalancesSummary extends BalanceSummary {
  /** Currencies left out of every figure because no exchange rate converts them. */
  excludedCurrencies: string[]
  /** Currencies counted at a converted rate. */
  convertedCurrencies: string[]
}

/** The account as it counts in the base currency: as is, converted, or null when no rate converts it. */
function inBaseCurrency(account: Account, baseCurrency: string, convert?: ConvertFn): Account | null {
  if (account.currency === baseCurrency) return account
  const balance = convert?.(account.balance, account.currency)
  return balance == null ? null : { ...account, balance: roundMoney(balance), currency: baseCurrency }
}

/** Balance totals in `baseCurrency`, converting what `convert` can and naming the currencies left out. */
export function summarizeBalances(accounts: Account[], baseCurrency: string, convert?: ConvertFn): BalancesSummary {
  const counted: Account[] = []
  const excluded = new Set<string>()
  const converted = new Set<string>()
  for (const account of accounts) {
    const value = inBaseCurrency(account, baseCurrency, convert)
    if (value) {
      counted.push(value)
      if (account.currency !== baseCurrency) converted.add(account.currency)
    } else {
      excluded.add(account.currency)
    }
  }
  const summary = getBalanceSummary(counted)
  return {
    // Converted balances are rounded to cents one by one, so the sums only need their float dust removed.
    totalAssets: roundMoney(summary.totalAssets),
    totalCreditCardDebt: roundMoney(summary.totalCreditCardDebt),
    totalLoanDebt: roundMoney(summary.totalLoanDebt),
    // Net worth sums signed balances, so a card in credit adds to it (see creditCards.ts).
    netWorth: roundMoney(summary.netWorth),
    excludedCurrencies: [...excluded].sort(),
    convertedCurrencies: [...converted].sort(),
  }
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
  convert?: ConvertFn,
): AccountsOverview {
  const inBase = new Map(accounts.map((account) => [account.id, inBaseCurrency(account, baseCurrency, convert)]))
  const counted = (account: Account) => inBase.get(account.id) != null
  const convertedBalance = (account: Account) =>
    account.currency !== baseCurrency && counted(account) ? (inBase.get(account.id) as Account).balance : null
  const assetAccounts = accounts.filter((account) => !isLiability(account))
  const liabilityAccounts = accounts.filter(isLiability)

  const baseBalance = (account: Account) => (inBase.get(account.id) as Account).balance
  // The Assets tile is the real sum, so an overdrawn asset lowers it and Assets - Liabilities
  // still equals Net Worth (LED-172). Shares stay percentages of the positive total, so an
  // overdrawn row (share 0%) does not shrink every other row's share.
  const totalAssets = roundMoney(assetAccounts.filter(counted).reduce((sum, account) => sum + baseBalance(account), 0))
  const positiveAssets = roundMoney(
    assetAccounts.filter(counted).reduce((sum, account) => sum + Math.max(0, baseBalance(account)), 0),
  )
  const assets = assetAccounts.map((account) => ({
    account,
    balance: account.balance,
    converted: convertedBalance(account),
    excluded: !counted(account),
    sharePct: counted(account) && positiveAssets > 0 ? (Math.max(0, baseBalance(account)) / positiveAssets) * 100 : counted(account) ? 0 : null,
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
        convertedOwed: counted(account) && account.currency !== baseCurrency ? getCreditCardSpending(inBase.get(account.id) as Account) : null,
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
      convertedOwed: counted(account) && account.currency !== baseCurrency ? getLoanAmountOwed(inBase.get(account.id) as Account) : null,
      excluded: !counted(account),
      utilizationPct: null,
      loanProgress: loanProgress(purchases, loans.allocations),
    }
  })

  const totalLiabilities = roundMoney(
    liabilities.filter((row) => !row.excluded).reduce((sum, row) => sum + (row.convertedOwed ?? row.owed), 0),
  )
  const { netWorth, excludedCurrencies, convertedCurrencies } = summarizeBalances(accounts, baseCurrency, convert)

  return {
    assets,
    liabilities,
    totals: { assets: totalAssets, liabilities: totalLiabilities, netWorth },
    excludedCurrencies,
    convertedCurrencies,
    comingUp: comingUp.sort((left, right) => left.days - right.days),
  }
}

/** "65%", "<1%", or "0%" for the share column. */
export function formatShare(pct: number): string {
  if (pct > 0 && pct < 1) return '<1%'
  return `${Math.round(pct)}%`
}
