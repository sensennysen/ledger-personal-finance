// When a row starts to count (LED-238). A row dated after today is scheduled: it shows in
// lists but stays out of spent, budget, Overspending and Home totals until its date arrives.
// Dates are local "YYYY-MM-DD" strings, so they compare as text. No app imports, so node --test loads it.

/** True when a row dated `date` counts toward totals on `today`. */
export function countsYet(date: string, today: string): boolean {
  return date <= today
}

/**
 * The last date a total over a range ending `end` counts up to. A closed range is unchanged;
 * an open one stops at today; one that starts after today ends before its start, so counts nothing.
 */
export function countedEnd(end: string, today: string): string {
  return end > today ? today : end
}

/** Rows that count on `today`, and the scheduled rest. Order is kept. */
export function splitCounted<T extends { date: string }>(rows: T[], today: string): { counted: T[]; scheduled: T[] } {
  const counted: T[] = []
  const scheduled: T[] = []
  for (const row of rows) (countsYet(row.date, today) ? counted : scheduled).push(row)
  return { counted, scheduled }
}

/** Rows within [start, end] that are dated after `today`: the range's scheduled rows. */
export function scheduledIn<T extends { date: string }>(rows: T[], start: string, end: string, today: string): T[] {
  return rows.filter((row) => row.date >= start && row.date <= end && !countsYet(row.date, today))
}

/** Milliseconds from `now` to the next local midnight, when "today" changes. */
export function msUntilNextLocalMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return next.getTime() - now.getTime()
}

/** The note beside a list's Sum when scheduled rows are in it: the Sum adds every listed row (LED-251). */
export function scheduledSumNote(scheduledCount: number): string | null {
  return scheduledCount > 0 ? `incl. ${scheduledCount} scheduled` : null
}
