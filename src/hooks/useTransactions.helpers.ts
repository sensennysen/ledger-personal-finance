import type { Account, Category, Transaction } from '@/types'

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
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'account' | 'to_account' | 'category' | 'subcategory'
>

type TxShape = Pick<
  Transaction,
  'account_id' | 'to_account_id' | 'type' | 'amount' | 'exchange_rate' | 'transfer_fee'
>

const RECURRING_KEY = 'ledger-recurring-generated'

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

    if (tx.type === 'transfer' && account.id === tx.to_account_id) {
      return { ...account, balance: account.balance + tx.amount * (tx.exchange_rate ?? 1) }
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

    if (tx.type === 'transfer' && account.id === tx.to_account_id) {
      return { ...account, balance: account.balance - tx.amount * (tx.exchange_rate ?? 1) }
    }

    return account
  })
}

export function txMatchesFilters(tx: Transaction, filters: TransactionFilters): boolean {
  if (filters.accountId && tx.account_id !== filters.accountId) return false
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

function getGeneratedMap(): Record<string, true> {
  try {
    return JSON.parse(localStorage.getItem(RECURRING_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function markRecurringGenerated(txId: string, date: string) {
  const map = getGeneratedMap()
  map[`${txId}__${date}`] = true

  try {
    localStorage.setItem(RECURRING_KEY, JSON.stringify(map))
  } catch {
    // Ignore storage write failures and fall back to generating again later.
  }
}

export function wasRecurringGenerated(txId: string, date: string): boolean {
  return getGeneratedMap()[`${txId}__${date}`] === true
}
