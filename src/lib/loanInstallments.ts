import type { LoanPaymentAllocation, LoanPurchase } from '@/types'

export interface LoanInstallment {
  purchaseId: string
  purchaseName: string
  dueDate: string
  scheduledAmount: number
  remainingAmount: number
  installmentNumber: number
}

export interface LoanDeadline {
  dueDate: string
  total: number
  items: LoanInstallment[]
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function calculateFlatMonthlyInstallment(principal: number, termMonths: number, monthlyRatePct: number): number {
  if (principal <= 0 || termMonths <= 0) return 0
  return roundMoney((principal * (1 + (monthlyRatePct / 100) * termMonths)) / termMonths)
}

export function addMonthsClamped(dateString: string, months: number): string {
  const [year, month, day] = dateString.split('-').map(Number)
  const target = new Date(year, month - 1 + months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  return [
    target.getFullYear(),
    String(target.getMonth() + 1).padStart(2, '0'),
    String(Math.min(day, lastDay)).padStart(2, '0'),
  ].join('-')
}

export function getPurchaseInstallments(
  purchase: LoanPurchase,
  allocations: LoanPaymentAllocation[],
): LoanInstallment[] {
  let paid = roundMoney(
    purchase.opening_paid_amount +
    allocations
      .filter((allocation) => allocation.loan_purchase_id === purchase.id)
      .reduce((sum, allocation) => sum + allocation.amount, 0),
  )

  return Array.from({ length: purchase.term_months }, (_, index) => {
    const scheduledAmount = index === purchase.term_months - 1
      ? roundMoney(purchase.total_payable - purchase.monthly_installment * index)
      : purchase.monthly_installment
    const applied = Math.min(paid, scheduledAmount)
    paid = roundMoney(paid - applied)

    return {
      purchaseId: purchase.id,
      purchaseName: purchase.name,
      dueDate: addMonthsClamped(purchase.first_due_date, index),
      scheduledAmount,
      remainingAmount: roundMoney(scheduledAmount - applied),
      installmentNumber: index + 1,
    }
  })
}

export function getLoanDeadlines(
  purchases: LoanPurchase[],
  allocations: LoanPaymentAllocation[],
): LoanDeadline[] {
  const deadlines = new Map<string, LoanInstallment[]>()

  for (const purchase of purchases) {
    for (const installment of getPurchaseInstallments(purchase, allocations)) {
      if (installment.remainingAmount <= 0) continue
      const items = deadlines.get(installment.dueDate) ?? []
      items.push(installment)
      deadlines.set(installment.dueDate, items)
    }
  }

  return [...deadlines.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dueDate, items]) => ({
      dueDate,
      total: roundMoney(items.reduce((sum, item) => sum + item.remainingAmount, 0)),
      items,
    }))
}

export function enrichLoanPurchase(
  purchase: LoanPurchase,
  allocations: LoanPaymentAllocation[],
): LoanPurchase {
  const paidAmount = roundMoney(
    purchase.opening_paid_amount +
    allocations
      .filter((allocation) => allocation.loan_purchase_id === purchase.id)
      .reduce((sum, allocation) => sum + allocation.amount, 0),
  )
  return {
    ...purchase,
    paid_amount: paidAmount,
    remaining_balance: roundMoney(Math.max(0, purchase.total_payable - paidAmount)),
  }
}
