import { createContext, useContext } from 'react'
import type { Transaction } from '@/types'
export const EntryContext = createContext<
  ((transaction: Transaction, onEdit?: () => void) => void) | null
>(null)
export const useEntryDetail = () => useContext(EntryContext)
