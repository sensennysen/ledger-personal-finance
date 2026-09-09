export const RECURRING_INTERVALS = [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'yearly',
] as const

export type RecurringInterval = (typeof RECURRING_INTERVALS)[number]

function formatDateString(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Add whole months to a date without the overflow that `Date.setMonth` causes.
 * Jan 31 + 1 month with `setMonth` becomes Mar 2/3 (skipping February entirely);
 * here it lands on Feb 28/29. A date that is the last day of its month snaps to
 * the last day of the target month so month-end schedules stay pinned to month-end.
 */
function addMonthsClamped(date: Date, months: number): Date {
  const lastDayOfSourceMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const isMonthEnd = date.getDate() === lastDayOfSourceMonth

  const target = new Date(date)
  target.setDate(1)
  target.setMonth(target.getMonth() + months)

  const lastDayOfTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(isMonthEnd ? lastDayOfTargetMonth : Math.min(date.getDate(), lastDayOfTargetMonth))
  return target
}

export function addRecurringInterval(date: Date, interval: RecurringInterval): Date {
  const nextDate = new Date(date)

  switch (interval) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1)
      break
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7)
      break
    case 'biweekly':
      nextDate.setDate(nextDate.getDate() + 14)
      break
    case 'monthly':
      return addMonthsClamped(date, 1)
    case 'quarterly':
      return addMonthsClamped(date, 3)
    case 'yearly':
      return addMonthsClamped(date, 12)
  }

  return nextDate
}

export function addRecurringIntervalToDateString(date: string, interval: RecurringInterval) {
  return formatDateString(addRecurringInterval(new Date(`${date}T00:00:00`), interval))
}

export function computeNextDueDate(lastDate: string, interval: RecurringInterval, floor: Date) {
  let nextDate = addRecurringInterval(new Date(`${lastDate}T00:00:00`), interval)

  while (nextDate < floor) {
    nextDate = addRecurringInterval(nextDate, interval)
  }

  return nextDate
}
