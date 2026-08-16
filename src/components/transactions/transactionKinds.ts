import type { TransactionType } from '@/types'

export type TransactionKind = TransactionType | 'loan-repayment'

export const TRANSACTION_KIND_LABELS: Record<TransactionKind, string> = {
  expense: 'Expense',
  income: 'Income',
  transfer: 'Transfer',
  'loan-repayment': 'Loan repayment',
}

export const TRANSACTION_KIND_DIALOG_TITLES: Record<TransactionKind, string> = {
  expense: 'Add expense',
  income: 'Add income',
  transfer: 'Record transfer',
  'loan-repayment': 'Record loan repayment',
}

export function inferTransactionKind(
  type: TransactionType | undefined,
  toAccountId?: string | null
): TransactionKind {
  if (type === 'expense' && toAccountId) return 'loan-repayment'
  return type ?? 'expense'
}
