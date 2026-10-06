// A receipt the form could not upload is saved as a pending marker. The row is saved without it,
// and the receipt follows as a queued edit, so it uploads when it can (LED-300).
import { PENDING_RECEIPT_PREFIX } from './receiptStore.ts'

/**
 * Splits a pending receipt off the values about to be saved online. `values` comes back without
 * receipt_url when it held a marker, so an edit leaves the row's receipt alone until the upload lands.
 */
export function splitPendingReceipt<T extends { receipt_url?: string | null }>(
  values: T,
): { values: T; marker: string | null } {
  const url = values.receipt_url
  if (typeof url !== 'string' || !url.startsWith(PENDING_RECEIPT_PREFIX)) return { values, marker: null }
  const rest = { ...values }
  delete rest.receipt_url
  return { values: rest, marker: url }
}
