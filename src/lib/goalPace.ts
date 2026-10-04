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

export type GoalStatus = { kind: 'on-track' } | { kind: 'behind'; by: number }

const DAY_MS = 86_400_000

/** Whole days from a to b, counted on calendar dates so a DST change can't shift a day. */
function daysBetween(a: Date, b: Date): number {
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / DAY_MS)
}

/**
 * On track or behind, on a straight line from the day the goal was created to its target date
 * (LED-235, OD-13 item 3): expected = target × days since creation ÷ days from creation to the
 * date, capped at the target. Saved at or above expected is on track; below is behind by the
 * difference. Past the date and not reached, expected is the whole target, so it is behind by
 * what remains. No target date, or complete: null, nothing is shown.
 * `createdAt` is the row's timestamp; it is read as a local date, like `deadline` (YYYY-MM-DD).
 */
export function goalStatus({
  target,
  saved,
  createdAt,
  deadline,
  isCompleted,
  today = new Date(),
}: {
  target: number
  saved: number
  createdAt: string
  deadline: string | null
  isCompleted: boolean
  today?: Date
}): GoalStatus | null {
  if (isCompleted || !deadline || target <= 0 || saved >= target) return null
  const created = new Date(createdAt)
  if (Number.isNaN(created.getTime())) return null
  const [y, m, d] = deadline.split('-').map(Number)
  const due = new Date(y, m - 1, d)
  const total = daysBetween(created, due)
  const elapsed = Math.max(0, daysBetween(created, today))
  // A date on or before the creation day, or already passed: the whole target is due.
  const share = total <= 0 ? 1 : Math.min(1, elapsed / total)
  const expected = target * share
  const by = Math.round((expected - saved) * 100) / 100
  return by > 0 ? { kind: 'behind', by } : { kind: 'on-track' }
}
