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
      nextDate.setMonth(nextDate.getMonth() + 1)
      break
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + 3)
      break
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + 1)
      break
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
