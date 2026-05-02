import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { CURRENCIES } from "@/types"
import type { Transaction, Category } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a Date as "YYYY-MM-DD" using the user's LOCAL timezone, not UTC. */
function localDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatCurrency(
  amount: number,
  currencyCode: string = 'USD',
  options?: Intl.NumberFormatOptions,
  locale: string = 'en-US',
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...options,
    }).format(amount)
  } catch {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...options,
    }).format(amount)
  }
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
    start: localDateStr(start),
    end: localDateStr(end),
  }
}

/**
 * Returns the start/end date strings for a given month key (e.g. "2026-05")
 * and a custom cycle start day (1–28).
 * e.g. key="2026-05", startDay=25 → "2026-05-25" to "2026-06-24"
 */
export function getCustomMonthRange(
  monthKey: string,
  startDay: number = 1,
): { start: string; end: string } {
  const [year, month] = monthKey.split('-').map(Number)
  const start = new Date(year, month - 1, startDay)
  // end = one day before the same startDay in the following month
  const end = new Date(year, month, startDay - 1)
  return {
    start: localDateStr(start),
    end: localDateStr(end),
  }
}

/**
 * Returns the "YYYY-MM" key for the current cycle, given a custom start day.
 * If today >= startDay of this calendar month → current month key.
 * Else → previous month key.
 */
export function getCurrentCycleMonthKey(startDay: number = 1): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() // 0-indexed
  const day = today.getDate()
  if (day >= startDay) {
    return `${year}-${String(month + 1).padStart(2, '0')}`
  }
  const prev = new Date(year, month - 1, 1)
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
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
      start: localDateStr(start),
      end: localDateStr(end),
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
      start: localDateStr(weekStart),
      end: localDateStr(weekEnd),
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
      start: localDateStr(start),
      end: localDateStr(end),
    })
  }
  return quarters
}

export function getCurrentWeekDays(): Array<{ label: string; start: string; end: string }> {
  const now = new Date()
  const mondayOffset = (now.getDay() + 6) % 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - mondayOffset)
  monday.setHours(0, 0, 0, 0)
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return dayNames.map((label, i) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    const dateStr = localDateStr(day)
    return { label, start: dateStr, end: dateStr }
  })
}

export function getCurrentMonthDays(): Array<{ label: string; start: string; end: string }> {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days = []
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    const dateStr = localDateStr(date)
    days.push({ label: String(d), start: dateStr, end: dateStr })
  }
  return days
}

export function getLast5Years(): Array<{ label: string; start: string; end: string }> {
  const currentYear = new Date().getFullYear()
  const years = []
  for (let i = 4; i >= 0; i--) {
    const y = currentYear - i
    years.push({ label: String(y), start: `${y}-01-01`, end: `${y}-12-31` })
  }
  return years
}

export function groupExpensesByCategory(
  transactions: Transaction[],
  categories: Category[],
  startDate: string,
  endDate: string,
  limit = 8,
): { name: string; color: string; icon: string; amount: number }[] {
  const map: Record<string, { name: string; color: string; icon: string; amount: number }> = {}
  for (const tx of transactions) {
    if (tx.type !== 'expense' || tx.date < startDate || tx.date > endDate || !tx.category_id) continue
    const cat = categories.find((c) => c.id === tx.category_id)
    if (!map[tx.category_id]) {
      map[tx.category_id] = {
        name: cat?.name ?? 'Unknown',
        color: cat?.color ?? '#94a3b8',
        icon: cat?.icon ?? '📦',
        amount: 0,
      }
    }
    map[tx.category_id].amount += tx.amount
  }
  return Object.values(map).sort((a, b) => b.amount - a.amount).slice(0, limit)
}
