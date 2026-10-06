import type { Account, Category, Transaction } from '@/types'
import { paymentCredit } from '@/lib/transferCredit'

export interface TransactionFilters {
  accountId?: string
  categoryId?: string
  type?: string
  startDate?: string
  endDate?: string
  limit?: number
}

export type TransactionUpsertValues = Omit<
  Transaction,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'account' | 'to_account' | 'category' | 'subcategory' | 'queued'
>

type TxShape = Pick<
  Transaction,
  'account_id' | 'to_account_id' | 'type' | 'amount' | 'exchange_rate' | 'destination_amount' | 'transfer_fee'
>

export function applyTxDelta(accounts: Account[], tx: TxShape): Account[] {
  return accounts.map((account) => {
    if (account.id === tx.account_id) {
      const delta =
        tx.type === 'income'
          ? tx.amount
          : tx.type === 'expense'
            ? -tx.amount
            : -(tx.amount + (tx.transfer_fee ?? 0))

      return { ...account, balance: account.balance + delta }
    }

    if ((tx.type === 'transfer' || tx.type === 'expense') && account.id === tx.to_account_id) {
      const destinationAmount = paymentCredit(tx)
      return { ...account, balance: account.balance + destinationAmount }
    }

    return account
  })
}

export function reverseTxDelta(accounts: Account[], tx: TxShape): Account[] {
  return accounts.map((account) => {
    if (account.id === tx.account_id) {
      const delta =
        tx.type === 'income'
          ? -tx.amount
          : tx.type === 'expense'
            ? tx.amount
            : tx.amount + (tx.transfer_fee ?? 0)

      return { ...account, balance: account.balance + delta }
    }

    if ((tx.type === 'transfer' || tx.type === 'expense') && account.id === tx.to_account_id) {
      const destinationAmount = paymentCredit(tx)
      return { ...account, balance: account.balance - destinationAmount }
    }

    return account
  })
}

export function txMatchesFilters(tx: Transaction, filters: TransactionFilters): boolean {
  if (filters.accountId && tx.account_id !== filters.accountId && tx.to_account_id !== filters.accountId) return false
  if (filters.categoryId && tx.category_id !== filters.categoryId) return false
  if (filters.type && tx.type !== filters.type) return false
  if (filters.startDate && tx.date < filters.startDate) return false
  if (filters.endDate && tx.date > filters.endDate) return false
  return true
}

export function buildTransactionsCacheKey(userId: string, filters: TransactionFilters): string {
  return `${userId}:transactions:${JSON.stringify({
    accountId: filters.accountId,
    categoryId: filters.categoryId,
    type: filters.type,
    startDate: filters.startDate,
    endDate: filters.endDate,
    limit: filters.limit,
  })}`
}

export function withTransactionDefaults<T extends object>(values: T): T & { tags: string[]; goal_id: string | null } {
  return {
    tags: [],
    goal_id: null,
    ...values,
  }
}

export function buildOptimisticTransaction(params: {
  values: TransactionUpsertValues
  userId: string
  now: string
  id: string
  accounts?: Account[]
  categories?: Category[]
}): Transaction {
  const { values, userId, now, id, accounts = [], categories = [] } = params

  return {
    ...withTransactionDefaults(params.values),
    id,
    user_id: userId,
    created_at: now,
    updated_at: now,
    account: accounts.find((account) => account.id === values.account_id),
    to_account: accounts.find((account) => account.id === values.to_account_id) ?? undefined,
    category: categories.find((category) => category.id === values.category_id) ?? undefined,
  }
}

export function limitTransactions(transactions: Transaction[], limit?: number): Transaction[] {
  return limit ? transactions.slice(0, limit) : transactions
}

// Until LED-232 each browser kept a map of recurring posts in local storage. The database records
// them now (recurrence_next_posted), so the map is gone; drop what an older version left behind.
export function forgetLegacyRecurringMap() {
  try {
    localStorage.removeItem('ledger-recurring-generated')
  } catch {
    // Storage unavailable: nothing was left behind either.
  }
}
