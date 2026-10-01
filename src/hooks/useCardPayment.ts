import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useNotify } from '@/contexts/notificationState'
import { useAccounts } from '@/hooks/useAccounts'
import { notifyAccountsRefresh } from '@/lib/cacheEvents'
import { creditedAmount, planStatementPayment, transferCard } from '@/lib/cardPayment'
import type { MutationResult } from '@/lib/dataErrors'
import type { TransactionUpsertValues } from '@/hooks/useTransactions.helpers'
import type { CardPaymentHandler } from '@/hooks/useTransactions'
import type { Account, CreditCardPayment } from '@/types'

type CreateTransaction = (values: TransactionUpsertValues) => Promise<MutationResult & { queued?: boolean }>

/**
 * One way to pay a card (LED-146). Wrap a form's `createTransaction`: a transfer into a credit card
 * also records the payment and moves the statement's paid amount, so "Amount to pay" updates
 * whichever screen the payment started from. Anything else is passed straight through.
 *
 * The transfer saves first. If a later step fails the payment is half-recorded, so it reports a
 * partial failure and Fix reruns only the steps that did not complete (`partial-failure-with-fix`).
 */
export function useCardPayment(
  createTransaction: CreateTransaction,
  onRecorded?: (payment: CreditCardPayment) => void,
) {
  const { user } = useAuth()
  const notify = useNotify()
  const { accounts, updateAccount, refetch } = useAccounts()

  // A plain function, not a callback: Fix calls it again, so it refers to itself.
  const recordStatementPayment = async (
    card: Account,
    amount: number,
    paymentDate: string,
    recorded: CreditCardPayment | null,
    retrying = false,
  ): Promise<void> => {
    if (!user) return
    const fix = (payment: CreditCardPayment | null) => {
      void refetch()
      notify({
        severity: 'partial',
        title: 'Payment recorded, statement not updated',
        body: `The transfer saved, but statement tracking for ${card.name} may be out of date.`,
        action: { label: 'Fix', run: () => void recordStatementPayment(card, amount, paymentDate, payment, true) },
      })
    }

    let payment = recorded
    if (!payment) {
      const { data, error } = await supabase
        .from('credit_card_payments')
        .insert({ user_id: user.id, account_id: card.id, amount, payment_date: paymentDate })
        .select('*')
        .single()
      if (error) return fix(null)
      payment = data as CreditCardPayment
      onRecorded?.(payment)
    }

    const { error } = await updateAccount(card.id, planStatementPayment(card, amount, paymentDate))
    if (error) return fix(payment)
    notifyAccountsRefresh()
    if (retrying) notify({ severity: 'success', title: `Statement updated for ${card.name}` })
  }

  const createWithStatement = async (values: TransactionUpsertValues) => {
    const card = transferCard(values, accounts)
    const result = await createTransaction(values)
    if (!card || result.error) return result

    const amount = creditedAmount(values)
    if (result.queued) {
      // The statement writes need a connection; Fix reruns them once it is back.
      notify({
        severity: 'partial',
        title: 'Payment saved offline, statement not updated',
        body: `The payment for ${card.name} syncs when you are back online. Fix updates its statement then.`,
        action: { label: 'Fix', run: () => void recordStatementPayment(card, amount, values.date, null, true) },
      })
      return result
    }
    void recordStatementPayment(card, amount, values.date, null)
    return result
  }

  /** A recurring transfer into a card that `generateDueRecurring` just posted (LED-190): same statement steps. */
  const recordGenerated: CardPaymentHandler = ({ card, amount, date }) => recordStatementPayment(card, amount, date, null)

  return { createWithStatement, recordGenerated }
}
