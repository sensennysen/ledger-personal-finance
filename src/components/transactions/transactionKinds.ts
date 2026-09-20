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
  expense: 'Add expense',
  income: 'Add income',
  transfer: 'Record transfer',
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
