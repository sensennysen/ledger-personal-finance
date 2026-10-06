// Live previews for the account form (LED-85). Pure, so node --test can load it.

function clampToMonth(year: number, monthIndex: number, day: number): Date {
  const last = new Date(year, monthIndex + 1, 0).getDate()
  return new Date(year, monthIndex, Math.min(day, last))
}

/**
 * Days between the next statement close and the payment due after it.
 * Statement 16 + due 1 is about 15–16 days depending on the month.
 */
export function daysToPay(statementDay: number | null | undefined, dueDay: number | null | undefined, today: Date = new Date()): number | null {
  if (!statementDay || !dueDay) return null
  if (statementDay < 1 || statementDay > 31 || dueDay < 1 || dueDay > 31) return null
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  let statement = clampToMonth(start.getFullYear(), start.getMonth(), statementDay)
  if (statement < start) statement = clampToMonth(start.getFullYear(), start.getMonth() + 1, statementDay)
  let due = clampToMonth(statement.getFullYear(), statement.getMonth(), dueDay)
  if (due <= statement) due = clampToMonth(statement.getFullYear(), statement.getMonth() + 1, dueDay)
  return Math.round((due.getTime() - statement.getTime()) / 86400000)
}

/** Limit minus what's owed; null without a limit. `owed` is the positive amount the user types. */
export function availableCredit(limit: number | null | undefined, owed: number): number | null {
  if (limit == null || !Number.isFinite(limit) || limit <= 0) return null
  return Math.round((limit - Math.abs(owed)) * 100) / 100
}

export function ordinal(day: number): string {
  const tens = day % 100
  if (tens >= 11 && tens <= 13) return `${day}th`
  return `${day}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[day % 10] ?? 'th'}`
}

/** Whether an edited account has history; 'unknown' is a failed check (LED-316). */
export type AccountHistoryState = 'none' | 'loading' | 'history' | 'unknown'

/** The currency selector is locked unless the account is known to have no history. */
export function currencyLocked(state: AccountHistoryState): boolean {
  return state !== 'none'
}

/** Why the currency can't change, under the selector; null when it can. */
export function currencyLockHint(state: AccountHistoryState): string | null {
  switch (state) {
    case 'history':
      return 'Locked: this account has transactions. Add a new account for another currency.'
    case 'unknown':
      return 'Locked: couldn’t check this account’s history. Reopen the form to try again.'
    case 'loading':
      return 'Checking this account’s history…'
    default:
      return null
  }
}
