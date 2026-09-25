import { useCallback } from 'react'
import { useNotify } from '@/contexts/notificationState'
import type { TransactionUpsertValues } from '@/hooks/useTransactions.helpers'
import { restoreTransactionInput } from '@/lib/undoRestore'
import type { Transaction } from '@/types'

type CreateTransaction = (values: TransactionUpsertValues) => Promise<{ error: string | null }>

const count = (n: number) => `${n} transaction${n !== 1 ? 's' : ''}`

/**
 * Delete outcomes on the notification surface: success offers Undo, a failed delete
 * offers Retry, and an undo that only partly restores says how many are still missing.
 */
export function useUndoDelete(createTransaction: CreateTransaction, onRestored?: () => void) {
  const notify = useNotify()

  const announceDeleted = useCallback((snapshots: Transaction[], title: string) => {
    const restore = async (pending: Transaction[]) => {
      const failed: Transaction[] = []
      for (const tx of pending) {
        const { error } = await createTransaction(restoreTransactionInput(tx))
        if (error) failed.push(tx)
      }
      onRestored?.()
      if (failed.length === 0) return
      const retry = { label: 'Retry', run: () => void restore(failed) }
      if (failed.length === pending.length) {
        notify({
          severity: 'failure',
          title: `Couldn't restore ${failed.length === 1 ? 'that transaction' : count(failed.length)}`,
          body: 'It is still deleted. Try again.',
          action: retry,
        })
      } else {
        notify({
          severity: 'partial',
          title: `Restored ${pending.length - failed.length} of ${count(pending.length)}`,
          body: `${count(failed.length)} ${failed.length === 1 ? 'is' : 'are'} still deleted.`,
          action: retry,
        })
      }
    }
    notify({ severity: 'success', title, action: { label: 'Undo', run: () => void restore(snapshots) } })
  }, [createTransaction, notify, onRestored])

  const announceDeleteFailed = useCallback((title: string, retry: () => void) => {
    notify({
      severity: 'failure',
      title,
      body: 'Nothing was deleted. Try again.',
      action: { label: 'Retry', run: retry },
    })
  }, [notify])

  return { announceDeleted, announceDeleteFailed }
}
