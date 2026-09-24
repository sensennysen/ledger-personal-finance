import type { LoanPaymentAllocation, LoanPurchase } from '@/types'
import { roundMoney } from './loanInstallments.ts'

export interface ItemizationGap {
  /** What the financed purchases still account for. */
  itemized: number
  /** Owed minus itemized: positive is debt with no schedule, negative is purchases the loan doesn't carry. */
  gap: number
}

/**
 * The loan balance and the purchases' remaining balances drift apart whenever the
 * balance is edited by hand. The purchase trigger adds `total_payable − paid` to the
 * loan, so a reconciled loan owes exactly the sum of what its purchases have left.
 */
export function getItemizationGap(
  owed: number,
  purchases: Pick<LoanPurchase, 'total_payable' | 'remaining_balance'>[],
): ItemizationGap {
  const itemized = roundMoney(
    purchases.reduce((sum, purchase) => sum + (purchase.remaining_balance ?? purchase.total_payable), 0),
  )
  const gap = roundMoney(owed - itemized)
  return { itemized, gap: Math.abs(gap) < 0.01 ? 0 : gap }
}

export interface PurchaseProgressSplit {
  /** Opening progress imported as already paid, as a percent of total payable. */
  importedPct: number
  /** Repayments recorded through Ledger, as a percent of total payable. */
  repaidPct: number
  importedAmount: number
  repaidAmount: number
}

/** Opening progress is not money that moved through Ledger, so it gets its own segment. */
export function splitPurchaseProgress(
  purchase: Pick<LoanPurchase, 'total_payable' | 'opening_paid_amount' | 'paid_amount'>,
): PurchaseProgressSplit {
  const total = purchase.total_payable
  const importedAmount = roundMoney(Math.min(purchase.opening_paid_amount, total))
  const repaidAmount = roundMoney(Math.max(0, Math.min(total, purchase.paid_amount ?? importedAmount) - importedAmount))
  if (total <= 0) return { importedPct: 0, repaidPct: 0, importedAmount, repaidAmount }
  const importedPct = (importedAmount / total) * 100
  return { importedPct, repaidPct: Math.min(100 - importedPct, (repaidAmount / total) * 100), importedAmount, repaidAmount }
}

/**
 * Names the installment each repayment paid off. Payments land in date order on top of
 * the opening progress, and installments fill in order, so replaying the running total
 * against each installment's boundary recovers the number. A payment that crosses a
 * boundary names the range it covered.
 */
export function labelAllocationInstallments(
  purchases: Pick<LoanPurchase, 'id' | 'term_months' | 'monthly_installment' | 'total_payable' | 'opening_paid_amount'>[],
  allocations: Pick<LoanPaymentAllocation, 'id' | 'loan_purchase_id' | 'amount' | 'created_at' | 'transaction'>[],
): Map<string, string> {
  const labels = new Map<string, string>()
  const ordered = [...allocations].sort((left, right) =>
    (left.transaction?.date ?? '').localeCompare(right.transaction?.date ?? '') || left.created_at.localeCompare(right.created_at))

  for (const purchase of purchases) {
    // Installment i (1-based) is fully paid once the running total reaches boundary(i).
    const boundary = (number: number) => number >= purchase.term_months
      ? purchase.total_payable
      : roundMoney(purchase.monthly_installment * number)
    const installmentAt = (paid: number) => {
      for (let number = 1; number <= purchase.term_months; number += 1) {
        if (boundary(number) >= paid - 0.005) return number
      }
      return purchase.term_months
    }

    let paid = purchase.opening_paid_amount
    for (const allocation of ordered) {
      if (allocation.loan_purchase_id !== purchase.id) continue
      const first = installmentAt(paid + 0.01)
      paid = roundMoney(paid + allocation.amount)
      const last = installmentAt(paid)
      labels.set(allocation.id, first === last ? `Installment ${first}` : `Installments ${first}–${last}`)
    }
  }
  return labels
}
