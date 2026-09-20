export type Lookback = '30d' | '90d' | 'ytd' | '12m'

export const LOOKBACK_OPTIONS: { value: Lookback; label: string }[] = [
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'ytd', label: 'Year to date' },
  { value: '12m', label: 'Last 12 months' },
]

export const DEFAULT_LOOKBACK: Lookback = '12m'

export interface LookbackBucket {
  start: string
  end: string
  label: string
}

const BUCKET_SIZE: Record<Lookback, 'daily' | 'weekly' | 'monthly'> = {
  '30d': 'daily',
  '90d': 'weekly',
  ytd: 'monthly',
  '12m': 'monthly',
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

function monthBucket(monthStart: Date, today: Date): LookbackBucket {
  const isCurrent =
    monthStart.getFullYear() === today.getFullYear() && monthStart.getMonth() === today.getMonth()
  const monthEnd = isCurrent
    ? today
    : new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
  const label = monthStart.getFullYear() !== today.getFullYear()
    ? monthStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    : monthStart.toLocaleDateString('en-US', { month: 'short' })
  return { start: dateStr(monthStart), end: dateStr(monthEnd), label }
}

/**
 * Contiguous, non-overlapping buckets for a trend chart's lookback, oldest
 * first, the last one ending on `today`. Bucket size adapts to the range:
 * 30 days daily, 90 days weekly, year to date and 12 months monthly.
 */
export function getLookbackBuckets(lookback: Lookback, today: Date): LookbackBucket[] {
  const y = today.getFullYear()
  const m = today.getMonth()
  const d = today.getDate()

  if (lookback === '30d') {
    return Array.from({ length: 30 }, (_, i) => {
      const day = new Date(y, m, d - (29 - i))
      return { start: dateStr(day), end: dateStr(day), label: shortDate(day) }
    })
  }

  if (lookback === '90d') {
    return Array.from({ length: 13 }, (_, i) => {
      const start = new Date(y, m, d - (12 - i) * 7 - 6)
      const end = new Date(y, m, d - (12 - i) * 7)
      return { start: dateStr(start), end: dateStr(end), label: shortDate(start) }
    })
  }

  const months = lookback === 'ytd' ? m + 1 : 12
  return Array.from({ length: months }, (_, i) =>
    monthBucket(new Date(y, m - (months - 1 - i), 1), today),
  )
}

/** e.g. "Last 90 days · Jun 19 – Sep 17 · weekly" */
export function getLookbackSubtitle(lookback: Lookback, today: Date): string {
  const buckets = getLookbackBuckets(lookback, today)
  const [sy, sm, sd] = buckets[0].start.split('-').map(Number)
  const first = new Date(sy, sm - 1, sd)
  const option = LOOKBACK_OPTIONS.find((o) => o.value === lookback)!
  return `${option.label} · ${shortDate(first)} – ${shortDate(today)} · ${BUCKET_SIZE[lookback]}`
}
