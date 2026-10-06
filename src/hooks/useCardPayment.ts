import { useNotify } from '@/contexts/notificationState'
import { useAccounts } from '@/hooks/useAccounts'
import { notifyAccountsRefresh, notifyCardPaymentsRefresh } from '@/lib/cacheEvents'
import { transferCard } from '@/lib/cardPayment'
import type { MutationResult } from '@/lib/dataErrors'
import type { TransactionUpsertValues } from '@/hooks/useTransactions.helpers'

type CreateTransaction = (values: TransactionUpsertValues) => Promise<MutationResult & { queued?: boolean; id?: string }>

/**
 * One way to pay a card (LED-146). Wrap a form's `createTransaction`: a transfer into a credit card
 * is a card payment, so "Amount to pay" and the payment history update whichever screen it started from.
 * Anything else is passed straight through.
 *
 * The database records the payment and moves the statement's paid amount in the same insert as the
 * transfer (LED-296), so a payment is counted once and never half-recorded. This hook only says so
 * when the payment is queued offline, and asks the card views to re-read once it is saved.
 */
export function useCardPayment(createTransaction: CreateTransaction) {
  const notify = useNotify()
  const { accounts } = useAccounts()

  const createWithStatement = async (values: TransactionUpsertValues) => {
    const card = transferCard(values, accounts)
    const result = await createTransaction(values)
    if (!card || result.error) return result

    if (result.queued) {
      // The payment and its statement are recorded when the queued transfer drains (LED-193).
      // Until then the payment can still be edited in the queue.
      notify({
        severity: 'success',
        title: 'Payment saved offline',
        body: `The payment for ${card.name} syncs when you are back online, and its statement updates then.`,
      })
      return result
    }
    notifyAccountsRefresh()
    notifyCardPaymentsRefresh()
    return result
  }

  return { createWithStatement }
}
