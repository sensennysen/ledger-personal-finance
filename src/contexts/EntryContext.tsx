import { createContext, useContext } from 'react'
import type { Transaction } from '@/types'

/** What the opener can do with the entry; each action shows only when passed. */
export interface EntryActions {
  onEdit?: () => void
  onDelete?: () => void
  onSplit?: () => void
}

export const EntryContext = createContext<
  ((transaction: Transaction, actions?: EntryActions) => void) | null
>(null)
export const useEntryDetail = () => useContext(EntryContext)
