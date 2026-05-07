import type { Account } from '@/types'

export function getCreditCardSpending(account: Account): number {
  if (account.type !== 'credit_card' || account.credit_limit == null) return 0
  return Math.max(0, account.credit_limit - account.balance)
}

export function getCreditCardNetWorthContribution(account: Account): number {
  if (account.type === 'credit_card' && account.credit_limit != null) {
    return account.balance - account.credit_limit
  }
  return account.balance
}

export function getCreditUtilizationPct(account: Account): number {
  if (account.type !== 'credit_card' || !account.credit_limit || account.credit_limit <= 0) return 0
  return Math.max(0, Math.min((getCreditCardSpending(account) / account.credit_limit) * 100, 999))
}

export function daysUntilDayOfMonth(day: number | null | undefined): number | null {
  if (!day || day < 1 || day > 31) return null

  const today = new Date()
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  const thisMonthDate = new Date(now.getFullYear(), now.getMonth(), Math.min(day, getDaysInMonth(now.getFullYear(), now.getMonth())))
  if (thisMonthDate >= now) {
    return Math.round((thisMonthDate.getTime() - now.getTime()) / 86400000)
  }

  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const nextMonthDate = new Date(
    nextMonth.getFullYear(),
    nextMonth.getMonth(),
    Math.min(day, getDaysInMonth(nextMonth.getFullYear(), nextMonth.getMonth()))
  )
  return Math.round((nextMonthDate.getTime() - now.getTime()) / 86400000)
}

function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate()
}

