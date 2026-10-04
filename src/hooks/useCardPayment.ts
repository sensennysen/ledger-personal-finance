import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useNotify } from '@/contexts/notificationState'
import { useAccounts } from '@/hooks/useAccounts'
import { notifyAccountsRefresh, notifyCardPaymentsRefresh } from '@/lib/cacheEvents'
import { creditedAmount, generatedCardPayment, planStatementPayment, transferCard } from '@/lib/cardPayment'
import type { QueueItem } from '@/lib/queueState'
import type { MutationResult } from '@/lib/dataErrors'
import type { TransactionUpsertValues } from '@/hooks/useTransactions.helpers'
import type { CardPaymentHandler } from '@/hooks/useTransactions'
import type { Account, CreditCardPayment } from '@/types'

type CreateTransaction = (values: TransactionUpsertValues) => Promise<MutationResult & { queued?: boolean; id?: string }>

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
    transactionId: string | null = null,
  ): Promise<void> => {
    if (!user) return
    const fix = (payment: CreditCardPayment | null) => {
      void refetch()
      notify({
        severity: 'partial',
        title: 'Payment recorded, statement not updated',
        body: `The transfer saved, but statement tracking for ${card.name} may be out of date.`,
        action: { label: 'Fix', run: () => void recordStatementPayment(card, amount, paymentDate, payment, true, transactionId) },
      })
    }

    let payment = recorded
    if (!payment) {
      const { data, error } = await supabase
        .from('credit_card_payments')
        .insert({ user_id: user.id, account_id: card.id, amount, payment_date: paymentDate, transaction_id: transactionId })
        .select('*')
        .single()
      if (error) return fix(null)
      payment = data as CreditCardPayment
      onRecorded?.(payment)
      notifyCardPaymentsRefresh()
    }

    // The statement as it is now, not the copy this closure was made with: an Undo or a Fix runs later,
    // after the paid amount may have moved (a delete took the payment back, LED-191).
    const { data: current, error: readError } = await supabase
      .from('accounts')
      .select('statement_balance, statement_paid_amount')
      .eq('id', card.id)
      .single()
    if (readError || !current) return fix(payment)
    const { error } = await updateAccount(card.id, planStatementPayment(current as Pick<Account, 'statement_balance' | 'statement_paid_amount'>, amount, paymentDate))
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
      // The statement steps need a connection, so they run when the queued payment drains
      // (`recordSynced`). Until then the payment can still be edited in the queue (LED-193).
      notify({
        severity: 'success',
        title: 'Payment saved offline',
        body: `The payment for ${card.name} syncs when you are back online, and its statement updates then.`,
      })
      return result
    }
    void recordStatementPayment(card, amount, values.date, null, false, result.id ?? null)
    return result
  }

  /** A recurring transfer into a card that `generateDueRecurring` just posted (LED-190): same statement steps. */
  const recordGenerated: CardPaymentHandler = ({ card, amount, date, transactionId }) =>
    recordStatementPayment(card, amount, date, null, false, transactionId)

  /**
   * The drain saved a queued insert (LED-193). When it is a transfer into a card, run the statement
   * steps once, on the card as it is now. Mounted by AppLayout only, so it never runs twice.
   */
  const recordSynced = async (item: QueueItem): Promise<void> => {
    if (item.table !== 'transactions') return
    const destination = item.payload.to_account_id
    if (typeof destination !== 'string') return
    const { data } = await supabase.from('accounts').select('*').eq('id', destination).maybeSingle()
    const payment = data
      ? generatedCardPayment(
          item.payload as Pick<TransactionUpsertValues, 'type' | 'to_account_id' | 'amount' | 'exchange_rate'>,
          [data as Account],
        )
      : null
    if (!payment) return
    await recordStatementPayment(
      payment.card,
      payment.amount,
      item.payload.date as string,
      null,
      false,
      typeof item.payload.id === 'string' ? item.payload.id : null,
    )
  }

  return { createWithStatement, recordGenerated, recordSynced }
}
