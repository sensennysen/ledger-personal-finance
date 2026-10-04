import type { TransactionKind } from '../components/transactions/transactionKinds.ts'
import type { TransactionFormInput } from '../components/transactions/transactionFormSchema.ts'

// Changing a transaction's kind keeps what every kind shares (amount, date,
// description, account, tags, notes, recurrence, receipt) and clears what only
// applies to the old kind, so the schema never rejects a field the user cannot
// see (LED-111 create, LED-112 edit).

const isLiabilityKind = (kind: TransactionKind) => kind === 'loan-repayment' || kind === 'card-payment'

export function applyKindChange(values: TransactionFormInput, nextKind: TransactionKind): TransactionFormInput {
  // Loan and card payments are expenses with a target account; the target is
  // picked by the liability form itself, so it always starts empty here.
  const nextType = isLiabilityKind(nextKind) ? 'expense' : (nextKind as TransactionFormInput['type'])
  // The destination goes, and with it the amount it received (LED-185).
  const next: TransactionFormInput = { ...values, type: nextType, to_account_id: null, destination_amount: null }

  // Categories are typed (expense / income / both) and a transfer has none, so
  // a category only survives when the type stays the same.
  if (nextType !== values.type || nextType === 'transfer') {
    next.category_id = null
    next.subcategory_id = null
  }
  if (nextType === 'transfer') next.goal_id = null
  if (nextType !== 'transfer') next.transfer_fee = null

  return next
}
