export interface ReportRange {
  start: string
  end: string
  label: string
  filenameLabel: string
}

function dateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function shortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * The date range Reports shows for the globally selected cycle
 * ("YYYY-MM" key plus the user's month start day).
 */
export function getReportRange(selectedMonth: string, startDay: number): ReportRange {
  const [year, month] = selectedMonth.split('-').map(Number)
  const start = new Date(year, month - 1, startDay)
  const end = new Date(year, month, startDay - 1)
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
