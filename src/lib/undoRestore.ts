import type { Transaction } from '@/types'

/** Everything a deleted transaction needs to come back exactly as it was. */
export function restoreTransactionInput(tx: Transaction) {
  return {
    type: tx.type,
    account_id: tx.account_id,
    to_account_id: tx.to_account_id,
    category_id: tx.category_id,
    subcategory_id: tx.subcategory_id,
    amount: tx.amount,
    currency: tx.currency,
    exchange_rate: tx.exchange_rate,
    description: tx.description,
    notes: tx.notes,
    date: tx.date,
    transfer_fee: tx.transfer_fee,
    is_recurring: tx.is_recurring,
    recurrence_interval: tx.recurrence_interval,
    recurrence_end_date: tx.recurrence_end_date,
    // A restored row that had posted its next occurrence must not post it again (LED-232).
    recurrence_next_posted: tx.recurrence_next_posted ?? false,
    receipt_url: tx.receipt_url,
    tags: tx.tags ?? [],
    goal_id: tx.goal_id ?? null,
  }
}
