import type { Account, LoanPaymentAllocation, LoanPurchase } from '@/types'
import { nextDeadlineInCycle } from './loanPicker.ts'
import { formatLoanSchedule } from './loans.ts'

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

export interface UpcomingLoanBill {
  key: string
  source: 'loan'
  title: string
  icon: string | null
  color: string
  amount: number
  currency: string
  detail: string | null
  nextDue: Date
  daysUntil: number | null
  /** The loan this bill pays, with the amount and due date the repayment form opens on (Pay now, LED-145). */
  payment: { accountId: string; amount: number; date: string } | null
}

function createDateAtLocalMidnight(date: string) {
  return new Date(`${date}T00:00:00`)
}

/** Format a Date as "YYYY-MM-DD" in the local timezone (mirrors `utils.ts`'s `getLocalDateString`,
 * kept separate so this file stays free of `@/` value imports and testable with `node --test`). */
function toLocalDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * The date Pay now opens on (LED-195). A loan payment's date decides its split
 * (`rules/loan-payment-date-decides-its-split.md`), so a bill already past due opens on today:
 * dated on the old due date it would allocate as if paid on time. A bill not yet due keeps its
 * due date. The form's Date field still lets the user change either.
 */
export function payNowDate(dueDate: string, today: Date): string {
  const todayString = toLocalDateString(today)
  return dueDate < todayString ? todayString : dueDate
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

/**
 * The loan bills for Home's Upcoming Bills strip, one per account (with a pay period) or
 * per purchase, for the cycle `cycleStart`..`cycleEnd`. Shared with Accounts' Coming up
 * (`accountsOverview.ts`) and the repayment form (`RepaymentAssist`), which both find an
 * account's next deadline the same way, so an overdue installment is never dropped just
 * because its due date is before today (LED-173): only the cycle's end bounds it out.
 */
export function buildUpcomingLoanBills(
  accounts: Account[],
  purchases: LoanPurchase[],
  allocations: LoanPaymentAllocation[],
  cycleStart: Date,
  cycleEnd: Date,
  isCurrentMonth: boolean,
  today: Date,
): UpcomingLoanBill[] {
  const bills: UpcomingLoanBill[] = []
  const dateIsInCycle = (date: string) => {
    const value = createDateAtLocalMidnight(date)
    return value >= cycleStart && value <= cycleEnd
  }
  const cycleEndString = toLocalDateString(cycleEnd)

  for (const account of accounts) {
    if (account.type !== 'loan') continue
    const accountPurchases = purchases.filter((purchase) => purchase.account_id === account.id)
    if (accountPurchases.length === 0) continue

    if (account.loan_pay_period) {
      const nextDeadline = getLoanDeadlines(accountPurchases, allocations).find((deadline) => dateIsInCycle(deadline.dueDate))
      if (!nextDeadline) continue
      const nextDue = createDateAtLocalMidnight(nextDeadline.dueDate)
      bills.push({
        key: `loan-account:${account.id}:${nextDeadline.dueDate}`,
        source: 'loan',
        title: account.name,
        icon: account.icon,
        color: account.color,
        amount: nextDeadline.total,
        currency: account.currency,
        detail: formatLoanSchedule(account),
        nextDue,
        daysUntil: isCurrentMonth ? Math.round((nextDue.getTime() - today.getTime()) / 86400000) : null,
        payment: { accountId: account.id, amount: nextDeadline.total, date: payNowDate(nextDeadline.dueDate, today) },
      })
      continue
    }

    // The repayment form always shows the account's single next deadline across every
    // purchase (RepaymentAssist, same builder as Accounts' Coming up), so every "Pay now"
    // for this account prefills that same amount and date, whichever purchase's row it's on.
    const accountDeadline = nextDeadlineInCycle(getLoanDeadlines(accountPurchases, allocations), cycleEndString)

    for (const purchase of accountPurchases) {
      const nextInstallment = getPurchaseInstallments(purchase, allocations)
        .find((installment) => installment.remainingAmount > 0 && dateIsInCycle(installment.dueDate))
      if (!nextInstallment) continue
      const nextDue = createDateAtLocalMidnight(nextInstallment.dueDate)
      const payment = accountDeadline
        ? { accountId: account.id, amount: accountDeadline.total, date: payNowDate(accountDeadline.dueDate, today) }
        : { accountId: account.id, amount: nextInstallment.remainingAmount, date: payNowDate(nextInstallment.dueDate, today) }
      bills.push({
        key: `loan-purchase:${purchase.id}:${nextInstallment.dueDate}`,
        source: 'loan',
        title: purchase.name,
        icon: purchase.category?.icon ?? account.icon,
        color: purchase.category?.color ?? account.color,
        amount: nextInstallment.remainingAmount,
        currency: account.currency,
        detail: account.name,
        nextDue,
        daysUntil: isCurrentMonth ? Math.round((nextDue.getTime() - today.getTime()) / 86400000) : null,
        payment,
      })
    }
  }

  return bills
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
