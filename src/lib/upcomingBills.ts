import { EXPENSE, WARNING_INK } from '../constants/colors.ts'

// A phone shows the next bill only, as design 18a's strip does, so Home's first four widgets fit
// above the bottom nav at 390x844 (LED-202); the rest are counted in "+N more", or expanded in
// the Needs attention card (M-08).
export const PHONE_LIMIT = 1

export function getUpcomingBillDayColor(daysUntil: number) {
  if (daysUntil <= 0) return EXPENSE
  if (daysUntil <= 3) return WARNING_INK
  return 'var(--muted-foreground)'
}

export function formatDaysUntil(daysUntil: number) {
  if (daysUntil < 0) return daysUntil === -1 ? '1 day overdue' : `${-daysUntil} days overdue`
  if (daysUntil === 0) return 'today'
  if (daysUntil === 1) return 'tomorrow'
  return `in ${daysUntil} days`
}
