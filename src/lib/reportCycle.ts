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
