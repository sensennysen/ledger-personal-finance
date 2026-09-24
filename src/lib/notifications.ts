export type NotificationSeverity = 'success' | 'failure' | 'partial'

export interface NotificationAction {
  label: string
  run: () => void
}

export interface NotificationInput {
  severity: NotificationSeverity
  title: string
  body?: string
  action?: NotificationAction
}

export interface Notification extends NotificationInput {
  id: number
  /** Milliseconds before it closes itself; null stays until acted on or dismissed. */
  duration: number | null
  role: 'status' | 'alert'
}

const SUCCESS_DURATION = 5000

/**
 * Success confirms something that already happened, so it can leave on its own.
 * A failure or a partial failure needs the user to act, so it stays and interrupts.
 */
export function notificationDefaults(severity: NotificationSeverity): Pick<Notification, 'duration' | 'role'> {
  return severity === 'success'
    ? { duration: SUCCESS_DURATION, role: 'status' }
    : { duration: null, role: 'alert' }
}

/** One notification at a time: the caller replaces whatever is showing with this. */
export function createNotification(input: NotificationInput, id: number): Notification {
  return { ...input, id, ...notificationDefaults(input.severity) }
}

/** Dismissing only closes the notification it was aimed at, never a newer one. */
export function dismissNotification(current: Notification | null, id: number): Notification | null {
  return current?.id === id ? null : current
}
