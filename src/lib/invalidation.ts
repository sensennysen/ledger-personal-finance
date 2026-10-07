// What a write makes stale (LED-306). Pure: the map is tested, and invalidateEntities takes the
// store and the listener bus as arguments.

import type { Entity } from './entityQuery.ts'

/** Every read a write can make stale: the store's entities plus the hooks that read on their own. */
export type ReadEntity = Entity | 'budgets' | 'loan-purchases'

/** What was written; `sync` is the offline queue draining or a conflict resolved. */
export type WriteSource = ReadEntity | 'sync'

// A transaction moves balances (database trigger), budget spend, goal contributions, card payments
// and statements (LED-296) and loan installments.
const TRANSACTION_EFFECTS: readonly ReadEntity[] = [
  'transactions', 'accounts', 'budgets', 'savings-goals', 'card-payments', 'loan-purchases',
]

export const INVALIDATES: Readonly<Record<WriteSource, readonly ReadEntity[]>> = {
  transactions: TRANSACTION_EFFECTS,
  sync: TRANSACTION_EFFECTS,
  // Transactions carry the account's name, colour and currency.
  accounts: ['accounts', 'transactions'],
  // Transactions and budgets carry the category's name, colour and icon.
  categories: ['categories', 'transactions', 'budgets'],
  'card-payments': ['card-payments', 'accounts'],
  'loan-purchases': ['loan-purchases'],
  'savings-goals': ['savings-goals'],
  budgets: ['budgets'],
  'exchange-rates': ['exchange-rates'],
}

export function invalidatedBy(source: WriteSource): readonly ReadEntity[] {
  return INVALIDATES[source]
}

interface InvalidatingStore {
  invalidateQueries: (filters: { predicate: (query: { queryKey: readonly unknown[] }) => boolean }) => Promise<void>
}

/**
 * After a write: every store read of an affected entity is marked stale, and those on screen refetch
 * (an idle one waits until it is used again); hooks outside the store hear `notify(entity)`.
 * Resolves once the reads on screen have refetched.
 */
export async function invalidateEntities(store: InvalidatingStore, source: WriteSource, notify: (entity: ReadEntity) => void): Promise<void> {
  const targets = invalidatedBy(source)
  targets.forEach(notify)
  await store.invalidateQueries({
    predicate: ({ queryKey }) => queryKey[0] === 'ledger' && targets.includes(queryKey[2] as ReadEntity),
  })
}
