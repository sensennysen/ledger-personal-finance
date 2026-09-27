import type { Account } from '@/types'
import type { TransactionKind } from '../components/transactions/transactionKinds.ts'
import { summarizeBalances } from './accountsOverview.ts'
import { loansOwed } from './loans.ts'

// The add-transaction kind menu as data, so the desktop dropdown and the phone
// bottom sheet render one list and cannot drift (LED-108, LED-109).

export type KindMenuGroup = 'primary' | 'liabilities'

export interface KindMenuItem {
  kind: TransactionKind
  label: string
  description: string
  group: KindMenuGroup
  /** Key cap on the desktop dropdown; absent for kinds that open a second step. */
  shortcut?: string
}

export interface KindMenuOptions {
  baseCurrency: string
  showLoanRepayment?: boolean
  showCardPayment?: boolean
  formatMoney: (amount: number) => string
}

// E / I / T fire the three primary kinds (LED-110). Loan repayment and card
// payment open a second step, so they get no letter. The search palette reads
// this too, so the two surfaces agree.
export const KIND_SHORTCUTS = {
  expense: 'E',
  income: 'I',
  transfer: 'T',
} as const

export type ShortcutKind = keyof typeof KIND_SHORTCUTS

export function kindForShortcut(key: string): ShortcutKind | null {
  const upper = key.toUpperCase()
  return (Object.keys(KIND_SHORTCUTS) as ShortcutKind[]).find((kind) => KIND_SHORTCUTS[kind] === upper) ?? null
}

const PRIMARY_ITEMS: KindMenuItem[] = [
  { kind: 'expense', label: 'Expense', description: 'Money spent from an account', group: 'primary', shortcut: KIND_SHORTCUTS.expense },
  { kind: 'income', label: 'Income', description: 'Money received into an account', group: 'primary', shortcut: KIND_SHORTCUTS.income },
  { kind: 'transfer', label: 'Transfer', description: 'Move money between accounts', group: 'primary', shortcut: KIND_SHORTCUTS.transfer },
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
  const loans = loansOwed(accounts, baseCurrency)
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

// A payment dialog is already about one loan or card, so the menu's aggregate
// line ("2 cards · $x due") would be wrong there. The designs (5b, 12a) draw
// this caption instead (LED-111).
const LIABILITY_DIALOG_SUBTITLES = {
  'loan-repayment': 'Posts as an expense against the loan · type locked',
  'card-payment': 'Posts as an expense against the card · type locked',
} as const

/** The line under a new-transaction dialog's title: the menu's own text for the three primary kinds. */
export function kindDialogSubtitle(kind: TransactionKind, items: KindMenuItem[]): string {
  if (kind === 'loan-repayment' || kind === 'card-payment') return LIABILITY_DIALOG_SUBTITLES[kind]
  return items.find((item) => item.kind === kind)?.description ?? ''
}

/** Change kind is offered only from the three primary kinds; a payment's form cannot be swapped safely. */
export function canChangeKind(kind: TransactionKind): boolean {
  return kind !== 'loan-repayment' && kind !== 'card-payment'
}
