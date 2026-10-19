import { dateStr, monthCycleDates } from './cycleRange.ts'

export interface ReportRange {
  start: string
  end: string
  label: string
  filenameLabel: string
}

function shortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * The date range Reports shows for the globally selected cycle
 * ("YYYY-MM" key plus the user's month start day).
 */
export function getReportRange(selectedMonth: string, startDay: number): ReportRange {
  const { start, end } = monthCycleDates(selectedMonth, startDay)
  const startStr = dateStr(start)
  const endStr = dateStr(end)
  const sameYear = start.getFullYear() === end.getFullYear()
  return {
    start: startStr,
    end: endStr,
    label: `${shortDate(start)} – ${shortDate(end)}${sameYear ? '' : `, ${end.getFullYear()}`}`,
    filenameLabel: `${startStr}_to_${endStr}`,
  }
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** A local "YYYY-MM-DD" as a Date at local midnight. */
function parseDay(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** True for a real calendar day ("2026-02-30" is not one). */
function isDay(value: string): boolean {
  return DAY_PATTERN.test(value) && dateStr(parseDay(value)) === value
}

/**
 * The custom range in a Reports URL (?from=YYYY-MM-DD&to=YYYY-MM-DD), or null when there is
 * none or it is not a valid range, in which case Reports follows the selected cycle.
 */
export function parseCustomRange(search: string): { start: string; end: string } | null {
  const params = new URLSearchParams(search)
  const from = params.get('from')
  const to = params.get('to')
  if (!from || !to || !isDay(from) || !isDay(to) || from > to) return null
  return { start: from, end: to }
}

/** A chosen range always names its year: it can lie anywhere, not just near the current cycle. */
export function customRangeLabel(start: string, end: string): string {
  const startDate = parseDay(start)
  const endDate = parseDay(end)
  const withYear = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (start === end) return withYear(startDate)
  return startDate.getFullYear() === endDate.getFullYear()
    ? `${shortDate(startDate)} – ${withYear(endDate)}`
    : `${withYear(startDate)} – ${withYear(endDate)}`
}

/** The date range Reports shows for a range the user picked. */
export function getCustomReportRange(start: string, end: string): ReportRange {
  return { start, end, label: customRangeLabel(start, end), filenameLabel: `${start}_to_${end}` }
}

/** The window of the same number of days that ends the day before `range` starts. */
export function previousRangeOf(range: { start: string; end: string }): { start: string; end: string } {
  const start = parseDay(range.start)
  const days = Math.round((parseDay(range.end).getTime() - start.getTime()) / 86400000) + 1
  return {
    start: dateStr(new Date(start.getFullYear(), start.getMonth(), start.getDate() - days)),
    end: dateStr(new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1)),
  }
}
