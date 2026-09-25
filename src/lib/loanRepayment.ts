import type { LoanPaymentAllocation, LoanPurchase } from '@/types'
import { daysUntilDate, loanProgress } from './accountsOverview.ts'
import { enrichLoanPurchase, getPurchaseInstallments, roundMoney, type LoanDeadline } from './loanInstallments.ts'

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

export function summariseRepayment(input: {
  outstanding: number
  deadline: LoanDeadline | null
  amount: number
  /** The form's Date field, YYYY-MM-DD: what is due on it decides how the payment is split. */
  date: string
  purchases: LoanPurchase[]
  allocations: LoanPaymentAllocation[]
  today: Date
}): RepaymentSummary {
  const { deadline, purchases, allocations, today } = input
  const outstanding = roundMoney(input.outstanding)
  const amount = Number.isFinite(input.amount) && input.amount > 0 ? input.amount : 0
  const overpays = exceedsOutstanding(amount, outstanding)
  const progress = loanProgress(purchases, allocations)
  // The count after is read off the same split the preview shows, so the two cannot disagree.
  const progressAfter = progress && !overpays && amount > 0
    ? loanProgress(purchases, [...allocations, ...previewLoanAllocation(purchases, allocations, amount, input.date).applied])
    : progress
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
          paidAfter: progressAfter?.paidInstallments ?? progress.paidInstallments,
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

export interface AllocationPreviewRow {
  purchaseId: string
  purchaseName: string
  /** The installment this payment reaches: the first one still unpaid. */
  installmentNumber: number
  termMonths: number
  applied: number
  remainingAfter: number
}

export interface AllocationPreview {
  rows: AllocationPreviewRow[]
  /** What would be written to loan_payment_allocations, one entry per purchase that receives money. */
  applied: LoanPaymentAllocation[]
}

/**
 * The split `allocate_loan_payment` makes when a repayment is saved (supabase/migrations/
 * 20260810123000_add_financed_purchases.sql), so the form can show it first. It is not
 * oldest-installment-first across purchases: phase 1 shares the payment across the purchases
 * in proportion to what each has due on `date`; anything left over is shared in proportion to
 * each one's remaining balance after phase 1. A payment dated before a due date therefore has
 * nothing due to fill and falls through to phase 2 (LED-83). Amounts round to the cent as the
 * SQL does, and the last purchase in a phase takes the remainder.
 *
 * `allocations` must not include the payment being previewed.
 */
export function previewLoanAllocation(
  purchases: LoanPurchase[],
  allocations: LoanPaymentAllocation[],
  amount: number,
  date: string,
): AllocationPreview {
  const ordered = [...purchases].sort(
    (a, b) =>
      a.first_due_date.localeCompare(b.first_due_date) ||
      a.created_at.localeCompare(b.created_at) ||
      a.id.localeCompare(b.id),
  )
  const paidBefore = new Map<string, number>()
  const dueOn = new Map<string, number>()
  for (const purchase of ordered) {
    const installments = getPurchaseInstallments(purchase, allocations)
    dueOn.set(
      purchase.id,
      roundMoney(installments.filter((item) => item.dueDate <= date).reduce((sum, item) => sum + item.remainingAmount, 0)),
    )
    paidBefore.set(purchase.id, enrichLoanPurchase(purchase, allocations).paid_amount ?? 0)
  }

  const applied = new Map<string, number>()
  const add = (purchaseId: string, value: number) =>
    applied.set(purchaseId, roundMoney((applied.get(purchaseId) ?? 0) + value))

  // One pass over `weights` in order, as each SQL loop does.
  const share = (weights: Map<string, number>, budget: number): number => {
    const positive = ordered.filter((purchase) => (weights.get(purchase.id) ?? 0) > 0)
    let weightRemaining = roundMoney([...weights.values()].reduce((sum, weight) => sum + weight, 0))
    let phaseRemaining = Math.min(budget, weightRemaining)
    let spent = 0
    for (const purchase of positive) {
      if (phaseRemaining <= 0 || weightRemaining <= 0) break
      const weight = weights.get(purchase.id) ?? 0
      let allocation = weightRemaining <= weight ? phaseRemaining : roundMoney((phaseRemaining * weight) / weightRemaining)
      allocation = Math.min(allocation, weight, phaseRemaining)
      if (allocation > 0) {
        add(purchase.id, allocation)
        phaseRemaining = roundMoney(phaseRemaining - allocation)
        spent = roundMoney(spent + allocation)
      }
      weightRemaining = roundMoney(weightRemaining - weight)
    }
    return spent
  }

  let paymentRemaining = roundMoney(amount)
  if (paymentRemaining > 0) {
    paymentRemaining = roundMoney(paymentRemaining - share(dueOn, paymentRemaining))
  }
  if (paymentRemaining > 0) {
    const remaining = new Map(
      ordered.map((purchase) => [
        purchase.id,
        roundMoney(Math.max(purchase.total_payable - (paidBefore.get(purchase.id) ?? 0) - (applied.get(purchase.id) ?? 0), 0)),
      ]),
    )
    share(remaining, paymentRemaining)
  }

  const rows: AllocationPreviewRow[] = []
  for (const purchase of ordered) {
    const next = getPurchaseInstallments(purchase, allocations).find((item) => item.remainingAmount > 0)
    if (!next) continue
    const appliedHere = applied.get(purchase.id) ?? 0
    rows.push({
      purchaseId: purchase.id,
      purchaseName: purchase.name,
      installmentNumber: next.installmentNumber,
      termMonths: purchase.term_months,
      applied: appliedHere,
      remainingAfter: roundMoney(Math.max(purchase.total_payable - (paidBefore.get(purchase.id) ?? 0) - appliedHere, 0)),
    })
  }

  return {
    rows,
    applied: ordered
      .filter((purchase) => (applied.get(purchase.id) ?? 0) > 0)
      .map((purchase) => ({ loan_purchase_id: purchase.id, amount: applied.get(purchase.id) ?? 0 }) as LoanPaymentAllocation),
  }
}
