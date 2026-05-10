import { useMemo, useState } from 'react'
import type { Budget, Transaction } from '@/types'

export type AlertType = 'budget_warning' | 'budget_exceeded' | 'large_transaction'

export interface SpendingAlert {
  id: string
  type: AlertType
  message: string
  budgetId?: string
  budgetName?: string
  percent?: number
}

const WARNING_THRESHOLD = 0.8

export function useSpendingAlerts(
  budgets: Budget[],
  transactions: Transaction[],
  largeTransactionThreshold: number = 0,
): SpendingAlert[] {
  const [referenceDate] = useState(() => new Date())

  return useMemo(() => {
    const alerts: SpendingAlert[] = []

    // Budget alerts
    for (const b of budgets) {
      if (!b.is_active) continue
      const spent = b.spent ?? 0
      const effective = b.effective_amount ?? b.amount
      if (effective <= 0) continue
      const percent = spent / effective
      if (percent >= 1) {
        alerts.push({
          id: `budget-exceeded-${b.id}`,
          type: 'budget_exceeded',
          message: `Budget "${b.name}" exceeded (${Math.round(percent * 100)}% spent)`,
          budgetId: b.id,
          budgetName: b.name,
          percent,
        })
      } else if (percent >= WARNING_THRESHOLD) {
        alerts.push({
          id: `budget-warning-${b.id}`,
          type: 'budget_warning',
          message: `Budget "${b.name}" is at ${Math.round(percent * 100)}%`,
          budgetId: b.id,
          budgetName: b.name,
          percent,
        })
      }
    }

    // Large transaction alerts (last 24 hours)
    if (largeTransactionThreshold > 0) {
      const today = referenceDate.toISOString().split('T')[0]
      const yesterdayDate = new Date(referenceDate)
      yesterdayDate.setDate(yesterdayDate.getDate() - 1)
      const yesterday = yesterdayDate.toISOString().split('T')[0]
      const recent = transactions.filter(
        (t) => t.type === 'expense' && t.date >= yesterday && t.date <= today && t.amount >= largeTransactionThreshold,
      )
      for (const tx of recent) {
        alerts.push({
          id: `large-tx-${tx.id}`,
          type: 'large_transaction',
          message: `Large transaction: "${tx.description}" — ${tx.currency} ${tx.amount.toFixed(2)}`,
        })
      }
    }

    return alerts
  }, [budgets, transactions, largeTransactionThreshold, referenceDate])
}
