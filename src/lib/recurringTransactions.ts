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

type RecurringSource = {
  date: string
  recurrence_interval: RecurringInterval | null
  recurrence_end_date: string | null
}

/**
 * The recurring rows whose next occurrence is due by `today`, each with that date (LED-232).
 * Whether it was already posted is the database's call: `post_recurring_transaction` decides.
 */
export function dueRecurringPosts<T extends RecurringSource>(rows: T[], today: string): { source: T; date: string }[] {
  const due: { source: T; date: string }[] = []
  for (const source of rows) {
    if (!source.recurrence_interval) continue
    const date = addRecurringIntervalToDateString(source.date, source.recurrence_interval)
    if (date > today) continue
    if (source.recurrence_end_date && date > source.recurrence_end_date) continue
    due.push({ source, date })
  }
  return due
}

/** What one run of the recurring generator did: rows it posted, posts that failed, and whether the read of due rows failed. */
export type RecurringRun = { posted: number; failed: number; readFailed?: boolean }

/**
 * The notice for a generator run, or null when there is nothing to report. A failed read is not
 * "nothing due": the user hears about it (AGENTS.md: sync failures are surfaced).
 */
export function recurringRunNotice(run: RecurringRun): { title: string; body: string } | null {
  if (run.readFailed) {
    return {
      title: "Couldn't check recurring transactions",
      body: 'Ledger could not read your recurring transactions, so nothing due was posted.',
    }
  }
  if (run.failed === 0) return null
  return {
    title: 'Recurring transactions not posted',
    body: `${run.failed} recurring ${run.failed === 1 ? 'transaction is' : 'transactions are'} due but could not be posted.`,
  }
}
