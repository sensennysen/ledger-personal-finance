import { useMemo } from 'react'
import { readCache } from '@/lib/dataCache'
import type { Transaction } from '@/types'

export function useTagSuggestions(): string[] {
  return useMemo(() => {
    const cached = readCache<Transaction[]>('transactions') ?? []
    const tagSet = new Set<string>()
    for (const tx of cached) {
      if (tx.tags) {
        for (const tag of tx.tags) {
          if (tag) tagSet.add(tag)
        }
      }
    }
    return Array.from(tagSet).sort()
  }, [])
}
