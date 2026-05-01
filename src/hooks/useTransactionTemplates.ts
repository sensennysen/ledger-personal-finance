import { useState, useCallback } from 'react'
import type { TransactionFormValues } from '@/components/transactions/TransactionForm'

const STORAGE_KEY = 'ledger_transaction_templates'

export interface TransactionTemplate {
  id: string
  name: string
  values: Omit<TransactionFormValues, 'date'>
  createdAt: string
}

function loadTemplates(): TransactionTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as TransactionTemplate[]) : []
  } catch {
    return []
  }
}

function persist(templates: TransactionTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}

export function useTransactionTemplates() {
  const [templates, setTemplates] = useState<TransactionTemplate[]>(loadTemplates)

  const addTemplate = useCallback((name: string, values: TransactionFormValues) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { date: _date, ...rest } = values
    const template: TransactionTemplate = {
      id: crypto.randomUUID(),
      name: name.trim(),
      values: rest,
      createdAt: new Date().toISOString(),
    }
    setTemplates((prev) => {
      const updated = [template, ...prev]
      persist(updated)
      return updated
    })
    return template.id
  }, [])

  const removeTemplate = useCallback((id: string) => {
    setTemplates((prev) => {
      const updated = prev.filter((t) => t.id !== id)
      persist(updated)
      return updated
    })
  }, [])

  return { templates, addTemplate, removeTemplate }
}
