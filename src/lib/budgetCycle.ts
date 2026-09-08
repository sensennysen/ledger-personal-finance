import type { Budget } from '@/types'
import {
  getCurrentCycleMonthKey,
  getCustomMonthRange,
  getLocalDateString,
} from '@/lib/utils'

/** Keep weekly/quarterly/yearly envelopes aligned with the selected cycle. */
export function getBudgetCycleRange(
  period: Budget['period'],
  month: string,
  startDay: number,
  today = new Date(),
) {
  if (period === 'monthly') return getCustomMonthRange(month, startDay)
  const reference =
    month === getCurrentCycleMonthKey(startDay, today)
      ? today
      : new Date(`${month}-${String(startDay).padStart(2, '0')}T00:00:00`)
  const year = reference.getFullYear()
  if (period === 'yearly')
    return { start: `${year}-01-01`, end: `${year}-12-31` }
  if (period === 'quarterly') {
    const quarter = Math.floor(reference.getMonth() / 3) * 3
    return {
      start: getLocalDateString(new Date(year, quarter, 1)),
      end: getLocalDateString(new Date(year, quarter + 3, 0)),
    }
  }
  const monday = new Date(reference)
  monday.setDate(reference.getDate() - ((reference.getDay() + 6) % 7))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { start: getLocalDateString(monday), end: getLocalDateString(sunday) }
}
