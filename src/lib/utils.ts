import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { CURRENCIES } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(
  amount: number,
  currencyCode: string = 'USD',
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(amount)
}

export function getCurrencySymbol(currencyCode: string): string {
  const currency = CURRENCIES.find((c) => c.code === currencyCode)
  return currency?.symbol ?? currencyCode
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateShort(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export function getMonthRange(date: Date = new Date()): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

export function getLast12Months(): Array<{ label: string; start: string; end: string }> {
  const months = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const start = new Date(date.getFullYear(), date.getMonth(), 1)
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
    months.push({
      label: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    })
  }
  return months
}

export function getLast8Weeks(): Array<{ label: string; start: string; end: string }> {
  const weeks = []
  const now = new Date()
  const dayOfWeek = now.getDay()
  const currentMonday = new Date(now)
  currentMonday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
  currentMonday.setHours(0, 0, 0, 0)
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(currentMonday)
    weekStart.setDate(currentMonday.getDate() - i * 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weeks.push({
      label: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      start: weekStart.toISOString().split('T')[0],
      end: weekEnd.toISOString().split('T')[0],
    })
  }
  return weeks
}

export function getLast8Quarters(): Array<{ label: string; start: string; end: string }> {
  const quarters = []
  const now = new Date()
  const currentQ = Math.floor(now.getMonth() / 3)
  for (let i = 7; i >= 0; i--) {
    let q = currentQ - i
    let y = now.getFullYear()
    while (q < 0) { q += 4; y -= 1 }
    const startMonth = q * 3
    const start = new Date(y, startMonth, 1)
    const end = new Date(y, startMonth + 3, 0)
    quarters.push({
      label: `Q${q + 1} '${String(y).slice(2)}`,
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    })
  }
  return quarters
}

