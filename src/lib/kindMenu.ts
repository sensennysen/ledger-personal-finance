import type { Account } from '@/types'
import type { TransactionKind } from '../components/transactions/transactionKinds.ts'
import { summarizeBalances } from './accountsOverview.ts'

// The add-transaction kind menu as data, so the desktop dropdown and the phone
// bottom sheet render one list and cannot drift (LED-108, LED-109).

export type KindMenuGroup = 'primary' | 'liabilities'

export interface KindMenuItem {
  kind: TransactionKind
  label: string
  description: string
  group: KindMenuGroup
}

export interface KindMenuOptions {
  baseCurrency: string
  showLoanRepayment?: boolean
  showCardPayment?: boolean
  formatMoney: (amount: number) => string
}

const PRIMARY_ITEMS: KindMenuItem[] = [
  { kind: 'expense', label: 'Expense', description: 'Money spent from an account', group: 'primary' },
  { kind: 'income', label: 'Income', description: 'Money received into an account', group: 'primary' },
  { kind: 'transfer', label: 'Transfer', description: 'Move money between accounts', group: 'primary' },
]

const LOAN_FALLBACK = 'Pay down a loan from another account'
const CARD_FALLBACK = 'Pay down a credit card from another account'

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`

export function loanRepaymentDescription(
  accounts: Account[],
  baseCurrency: string,
  formatMoney: (amount: number) => string,
): string {
  // Totals only count the base currency (LED-135); a loan in another currency
  // has no rate to convert with, so it is left out of the sentence.
  const loans = accounts.filter((account) => account.type === 'loan' && account.currency === baseCurrency)
  if (loans.length === 0) return LOAN_FALLBACK
  const { totalLoanDebt } = summarizeBalances(loans, baseCurrency)
  return `${plural(loans.length, 'loan')} · ${formatMoney(totalLoanDebt)} owed`
}

export function cardPaymentDescription(
  accounts: Account[],
  baseCurrency: string,
  formatMoney: (amount: number) => string,
): string {
  const cards = accounts.filter(
    (account) => account.type === 'credit_card' && account.balance !== 0 && account.currency === baseCurrency,
  )
  if (cards.length === 0) return CARD_FALLBACK
  const { totalCreditCardDebt } = summarizeBalances(cards, baseCurrency)
  if (cards.length === 1) return `${cards[0].name} · ${formatMoney(totalCreditCardDebt)} due`
  return `${cards.length} cards · ${formatMoney(totalCreditCardDebt)} due`
}

export function kindMenuItems(accounts: Account[], options: KindMenuOptions): KindMenuItem[] {
  const { baseCurrency, showLoanRepayment = true, showCardPayment = true, formatMoney } = options
  const hasLoans = showLoanRepayment && accounts.some((account) => account.type === 'loan')
  const hasCardBalance =
    showCardPayment && accounts.some((account) => account.type === 'credit_card' && account.balance !== 0)

  const items = PRIMARY_ITEMS.map((item) => ({ ...item }))
  if (hasLoans) {
    items.push({
      kind: 'loan-repayment',
      label: 'Loan repayment',
      description: loanRepaymentDescription(accounts, baseCurrency, formatMoney),
      group: 'liabilities',
    })
  }
  if (hasCardBalance) {
    items.push({
      kind: 'card-payment',
      label: 'Card payment',
      description: cardPaymentDescription(accounts, baseCurrency, formatMoney),
      group: 'liabilities',
    })
  }
  return items
}
