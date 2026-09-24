import type { LoanPurchase } from '@/types'
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
