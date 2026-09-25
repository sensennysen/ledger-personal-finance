import type { LoanPaymentAllocation, LoanPurchase } from '@/types'
import { daysUntilDate, loanProgress } from './accountsOverview.ts'
import { getPurchaseInstallments, roundMoney, type LoanDeadline } from './loanInstallments.ts'

export interface RepaymentSummary {
  outstanding: number
  /** The deadline this payment is measured against; null when none falls in the cycle. */
  installmentDue: { amount: number; date: string; inDays: number } | null
  /** Balance after this payment; null when the amount is not a valid payment (over outstanding). */
  after: number | null
  overpays: boolean
  /** Installments paid across the loan's purchases, before and after; null without itemised purchases. */
  installments: { paid: number; total: number; paidAfter: number } | null
}

/** Compared to the cent: a balance held as a float must not reject its own rounded figure. */
export function exceedsOutstanding(amount: number, outstanding: number): boolean {
  return roundMoney(amount) > roundMoney(outstanding)
}

/** How many installments are paid once `amount` clears the unpaid ones, earliest due date first. */
function installmentsPaidAfter(
  purchases: LoanPurchase[],
  allocations: LoanPaymentAllocation[],
  amount: number,
): number {
  const all = purchases.flatMap((purchase) => getPurchaseInstallments(purchase, allocations))
  let paid = all.filter((item) => item.remainingAmount <= 0).length
  let left = roundMoney(amount)
  const unpaid = all
    .filter((item) => item.remainingAmount > 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  for (const item of unpaid) {
    if (left < item.remainingAmount) break
    left = roundMoney(left - item.remainingAmount)
    paid += 1
  }
  return paid
}

export function summariseRepayment(input: {
  outstanding: number
  deadline: LoanDeadline | null
  amount: number
  purchases: LoanPurchase[]
  allocations: LoanPaymentAllocation[]
  today: Date
}): RepaymentSummary {
  const { deadline, purchases, allocations, today } = input
  const outstanding = roundMoney(input.outstanding)
  const amount = Number.isFinite(input.amount) && input.amount > 0 ? input.amount : 0
  const overpays = exceedsOutstanding(amount, outstanding)
  const progress = loanProgress(purchases, allocations)
  return {
    outstanding,
    installmentDue: deadline
      ? { amount: deadline.total, date: deadline.dueDate, inDays: daysUntilDate(deadline.dueDate, today) }
      : null,
    after: overpays ? null : roundMoney(outstanding - amount),
    overpays,
    installments: progress
      ? {
          paid: progress.paidInstallments,
          total: progress.totalInstallments,
          paidAfter: overpays ? progress.paidInstallments : installmentsPaidAfter(purchases, allocations, amount),
        }
      : null,
  }
}

export type RepaymentPresetId = 'installment' | 'full' | 'custom'

export interface RepaymentPresets {
  /** Null when no deadline falls in the cycle. Never above what is outstanding. */
  installment: number | null
  full: number
  defaultPreset: RepaymentPresetId
}

export function getRepaymentPresets(outstanding: number, deadline: LoanDeadline | null): RepaymentPresets {
  const full = roundMoney(outstanding)
  const installment = deadline ? Math.min(roundMoney(deadline.total), full) : null
  return {
    installment,
    full,
    defaultPreset: installment != null && installment > 0 ? 'installment' : 'custom',
  }
}
