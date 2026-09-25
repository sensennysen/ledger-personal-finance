import type { AccountType, TransactionType } from '@/types'

export type TransactionKind = TransactionType | 'loan-repayment' | 'card-payment'

export const TRANSACTION_KIND_LABELS: Record<TransactionKind, string> = {
  expense: 'Expense',
  income: 'Income',
  transfer: 'Transfer',
  'loan-repayment': 'Loan repayment',
  'card-payment': 'Card payment',
}

export const TRANSACTION_KIND_DIALOG_TITLES: Record<TransactionKind, string> = {
  expense: 'New expense',
  income: 'New income',
  transfer: 'New transfer',
  'loan-repayment': 'Record loan repayment',
  'card-payment': 'Record card payment',
}

// An expense with a target account is a payment against a liability; the target's
// account type says which. Unknown type (account missing or not loaded) keeps the
// historical 'loan-repayment' reading.
export function inferTransactionKind(
  type: TransactionType | undefined,
  toAccountId?: string | null,
  toAccountType?: AccountType | null
): TransactionKind {
  if (type === 'expense' && toAccountId) {
    return toAccountType === 'credit_card' ? 'card-payment' : 'loan-repayment'
  }
  return type ?? 'expense'
}

// The card payment modal is drawn at 720px (12a), inset 24px where the viewport is narrower;
// every other kind keeps the compact width. Below `sm` all dialogs are the phone sheet.
const CARD_PAYMENT_DIALOG_WIDTH = 'sm:max-w-[min(720px,calc(100vw-3rem))]'
const COMPACT_DIALOG_WIDTH = 'max-w-md'

export function entryDialogWidthClass(kind: TransactionKind): string {
  return kind === 'card-payment' ? `${COMPACT_DIALOG_WIDTH} ${CARD_PAYMENT_DIALOG_WIDTH}` : COMPACT_DIALOG_WIDTH
}
