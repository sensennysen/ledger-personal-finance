export type GoalPaceStatus = 'done' | 'no-date' | 'overdue' | 'on-pace'

export interface GoalPace {
  remaining: number
  /** Share saved, held to 0–100. */
  pct: number
  /** Calendar months until the target date, at least 1; null without a future date. */
  monthsLeft: number | null
  /** What to save each month to hit the date; null unless status is 'on-pace'. */
  perMonth: number | null
  status: GoalPaceStatus
}

/** What a goal needs from target + saved + target date. `deadline` is YYYY-MM-DD. */
export function goalPace({
  target,
  saved,
  deadline,
  today = new Date(),
}: {
  target: number
  saved: number
  deadline: string | null
  today?: Date
}): GoalPace {
  const remaining = Math.max(0, target - saved)
  const pct = target > 0 ? Math.min(Math.max((saved / target) * 100, 0), 100) : 0
  const base = { remaining, pct, monthsLeft: null, perMonth: null }
  if (remaining === 0) return { ...base, status: 'done' }
  if (!deadline) return { ...base, status: 'no-date' }

  const [y, m, d] = deadline.split('-').map(Number)
  const due = new Date(y, m - 1, d)
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (due < startOfToday) return { ...base, status: 'overdue' }

  const monthsLeft = Math.max(1, (y - today.getFullYear()) * 12 + (m - 1 - today.getMonth()))
  return { ...base, monthsLeft, perMonth: remaining / monthsLeft, status: 'on-pace' }
}
