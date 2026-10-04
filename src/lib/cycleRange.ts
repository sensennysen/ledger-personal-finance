export interface DateRange {
  start: string
  end: string
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Format a Date as "YYYY-MM-DD" in local time. Pure, so node tests can import it. */
export function dateStr(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Start and end dates of the cycle for a "YYYY-MM" key and month start day.
 * e.g. "2026-05", 25 -> 2026-05-25 to 2026-06-24. The single source for cycle boundaries.
 */
export function monthCycleDates(monthKey: string, startDay: number): { start: Date; end: Date } {
  const [year, month] = monthKey.split('-').map(Number)
  return {
    start: new Date(year, month - 1, startDay),
    end: new Date(year, month, startDay - 1),
  }
}

export function monthCycleRange(monthKey: string, startDay: number): DateRange {
  const { start, end } = monthCycleDates(monthKey, startDay)
  return { start: dateStr(start), end: dateStr(end) }
}
