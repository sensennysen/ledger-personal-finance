// What a transfer credits to its destination account (LED-185). The database's balance trigger
// credits coalesce(destination_amount, amount * exchange_rate):
// supabase/migrations/20261003120000_transfer_destination_amount.sql. destination_amount is set
// only for a transfer between two currencies, in the destination's currency; every other transfer
// (and every row from before LED-185) credits amount * exchange_rate, which is the amount itself
// because exchange_rate is 1 on every row. Every client mirror of the trigger reads it from here.

export interface TransferCreditInput {
  amount: number
  exchange_rate?: number | null
  destination_amount?: number | null
}

export function transferCredit(tx: TransferCreditInput): number {
  return tx.destination_amount ?? tx.amount * (tx.exchange_rate ?? 1)
}

/**
 * What a row credits its destination account (LED-269). A transfer credits transferCredit; a loan
 * repayment (an expense into a loan) credits coalesce(destination_amount, amount), as the balance
 * trigger and allocate_loan_payment do: supabase/migrations/20261006130000_liability_payment_destination_amount.sql.
 * destination_amount is set only when the loan holds another currency than the payment.
 */
export function paymentCredit(tx: TransferCreditInput & { type: 'income' | 'expense' | 'transfer' }): number {
  return tx.type === 'transfer' ? transferCredit(tx) : (tx.destination_amount ?? tx.amount)
}

export interface TransferValues {
  type: 'income' | 'expense' | 'transfer'
  currency: string
  to_account_id?: string | null
}

/**
 * A transfer whose destination account holds another currency than the amount sent. Only then does
 * the destination need its own amount; `toCurrency` is the destination account's currency, or
 * undefined when the account is not known (no destination chosen, or the account is not loaded).
 */
export function isCrossCurrencyTransfer(values: TransferValues, toCurrency: string | null | undefined): boolean {
  return values.type === 'transfer' && Boolean(values.to_account_id) && Boolean(toCurrency) && toCurrency !== values.currency
}

/**
 * A payment whose destination holds another currency than the amount sent, so the form asks for the
 * amount received (LED-269): a transfer, a card payment, or a loan repayment (an expense into a loan;
 * no other expense has a destination). `toCurrency` as in isCrossCurrencyTransfer.
 */
export function needsAmountReceived(values: TransferValues, toCurrency: string | null | undefined): boolean {
  return values.type !== 'income' && Boolean(values.to_account_id) && Boolean(toCurrency) && toCurrency !== values.currency
}

/** The destination amount to save: the entered figure for a payment between two currencies, else null. */
export function destinationAmountFor(
  values: TransferValues & { destination_amount?: number | null },
  toCurrency: string | null | undefined,
): number | null {
  if (!needsAmountReceived(values, toCurrency)) return null
  const amount = values.destination_amount
  return amount != null && Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null
}
