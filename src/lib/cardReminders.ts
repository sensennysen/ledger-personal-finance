// Card reminders (LED-266). Pure: which reminders are due today, and the rows that record the ones
// shown, in `card_reminders_sent`. A row is the claim: only the device whose insert adds it shows it.

export interface ReminderCard {
  id: string
  name: string
  currency: string
  /** Days until the statement closes, or null when the card has no statement day. */
  statementDays: number | null
  /** Days until payment is due, or null when the card has no due day. */
  dueDays: number | null
  remainingToPay: number
  reminderDays: number
}

export interface CardReminder {
  key: string
  title: string
  body: string
}

export interface ReminderRow {
  user_id: string
  reminder_key: string
  sent_on: string
}

/** How long a shown reminder is remembered. Keys carry their day, so an older one can never recur. */
export const REMINDER_KEEP_DAYS = 60

/** The reminders the cards call for today, each with the key that records it. */
export function dueCardReminders(cards: ReminderCard[], today: string): CardReminder[] {
  const reminders: CardReminder[] = []
  for (const card of cards) {
    if (card.statementDays === 0) {
      reminders.push({
        key: `${card.id}:statement:${today}`,
        title: `${card.name}: Statement Day`,
        body: 'Your statement closes today. Check your locked statement balance.',
      })
    }
    const { dueDays } = card
    if (dueDays !== null && dueDays >= 0 && dueDays <= card.reminderDays && card.remainingToPay > 0) {
      reminders.push({
        key: `${card.id}:due:${today}:${dueDays}`,
        title: `${card.name}: Payment ${dueDays === 0 ? 'Due Today' : 'Due Soon'}`,
        body: dueDays === 0
          ? `Payment due today. Remaining: ${card.remainingToPay.toFixed(2)} ${card.currency}.`
          : `Payment due in ${dueDays} day(s). Remaining: ${card.remainingToPay.toFixed(2)} ${card.currency}.`,
      })
    }
  }
  return reminders
}

/** The first day still remembered: rows sent before it are deleted. */
export function pruneCutoff(today: string): string {
  const [year, month, day] = today.split('-').map(Number)
  const cutoff = new Date(Date.UTC(year, month - 1, day - REMINDER_KEEP_DAYS))
  return cutoff.toISOString().slice(0, 10)
}

const KEY = /^[^:]+:(?:statement|due):(\d{4}-\d{2}-\d{2})(?::\d+)?$/

/**
 * The browser's old `<user id>:cc-notifs-sent` map as rows for `userId`: reminder keys this code
 * writes, dated by the day inside them, and only those still remembered.
 */
export function legacyReminderRows(raw: string | null, userId: string, today: string): ReminderRow[] {
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return []
  const cutoff = pruneCutoff(today)
  const rows: ReminderRow[] = []
  for (const [key, sent] of Object.entries(parsed as Record<string, unknown>)) {
    const match = KEY.exec(key)
    if (sent !== true || !match || match[1] < cutoff) continue
    rows.push({ user_id: userId, reminder_key: key, sent_on: match[1] })
  }
  return rows
}

/** The per-user key the reminders lived under before LED-266. */
export function legacyRemindersKey(userId: string): string {
  return `${userId}:cc-notifs-sent`
}

export function readLegacyReminders(userId: string): string | null {
  try {
    return localStorage.getItem(legacyRemindersKey(userId))
  } catch {
    return null
  }
}

export function forgetLegacyReminders(userId: string): void {
  try {
    localStorage.removeItem(legacyRemindersKey(userId))
  } catch {
    /* storage unavailable: nothing to remove */
  }
}
