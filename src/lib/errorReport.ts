// What an error report carries to `error_events` (LED-258). Pure: the reporter sends these. Nothing
// financial leaves the browser: numbers, quoted text, ids and e-mail addresses are taken out of the
// message, and the route keeps its path without ids or a query.

export type ErrorKind = 'boundary' | 'card' | 'error' | 'rejection'

export interface ErrorEvent {
  kind: ErrorKind
  message: string
  route: string
  release: string
  user_agent: string
  stack: string | null
}

export interface ErrorContext {
  pathname: string
  release: string
  userAgent: string
}

/** Reports per page load, so a render loop does not flood the table. */
export const MAX_REPORTS_PER_LOAD = 10

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
const EMAIL = /[^\s@'"()<>]+@[^\s@'"()<>]+\.[a-z]{2,}/gi

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/**
 * The message with what could be personal taken out: quoted text ("Lunch", 'Lunch'), a database
 * key's values (`Key (name)=(Lunch)`), e-mail addresses, ids and every number (an amount, a date).
 */
export function scrubMessage(message: string): string {
  return clip(
    message
      .replace(/=\([^)]*\)/g, '=(…)')
      .replace(/"[^"]*"|'[^']*'|“[^”]*”|‘[^’]*’|`[^`]*`/g, '"…"')
      .replace(EMAIL, '<email>')
      .replace(UUID, '<id>')
      .replace(/\d+(?:[.,]\d+)*/g, '#')
      .replace(/\s+/g, ' ')
      .trim() || 'Unknown error',
    500,
  )
}

/** The route without ids or long digit runs: `/accounts/<id>`. The query and hash are never passed in. */
export function scrubRoute(pathname: string): string {
  return clip(pathname.replace(UUID, '<id>').replace(/\/\d+(?=\/|$)/g, '/<n>') || '/', 200)
}

const FRAME = /^\s+at |@\S*:\d+:\d+/

/**
 * A stack keeps code locations only. V8 repeats the message above the frames, so those lines go
 * (the scrubbed message is sent on its own); URLs lose their query; quoted text and ids are taken out.
 */
export function scrubStack(stack: string | null | undefined): string | null {
  if (!stack) return null
  const lines = stack.split('\n')
  const firstFrame = lines.findIndex((line) => FRAME.test(line))
  const frames = (firstFrame === -1 ? [] : lines.slice(firstFrame)).join('\n')
  if (!frames) return null
  return clip(
    frames
      .replace(/\?[^\s):]*/g, '')
      .replace(/"[^"\n]*"|'[^'\n]*'/g, '"…"')
      .replace(UUID, '<id>'),
    4000,
  )
}

function describe(error: unknown): { message: string; stack: string | null } {
  if (error instanceof Error) return { message: `${error.name}: ${error.message}`, stack: error.stack ?? null }
  if (typeof error === 'string') return { message: error, stack: null }
  if (typeof error === 'object' && error !== null && typeof (error as { message?: unknown }).message === 'string') {
    return { message: (error as { message: string }).message, stack: null }
  }
  return { message: 'Non-error value thrown', stack: null }
}

/** The row for one failure. `componentStack` comes from a React error boundary. */
export function buildErrorEvent(kind: ErrorKind, error: unknown, context: ErrorContext, componentStack?: string | null): ErrorEvent {
  const { message, stack } = describe(error)
  const stacks = [stack, componentStack ? `Component stack:${componentStack}` : null].filter(Boolean).join('\n')
  return {
    kind,
    message: scrubMessage(message),
    route: scrubRoute(context.pathname),
    release: clip(context.release || 'unknown', 64),
    user_agent: clip(context.userAgent, 300),
    stack: scrubStack(stacks),
  }
}

/** Local development never reports: a dev build, or a page served from this machine. */
export function shouldReport(env: { prod: boolean; hostname: string }): boolean {
  if (!env.prod) return false
  return !/^(localhost|127\.0\.0\.1|\[::1\]|.+\.localhost|.+\.test)$/i.test(env.hostname)
}

/**
 * Remembers what this page load has reported. A failure already sent (same kind, message and
 * route) is not sent again, and at most MAX_REPORTS_PER_LOAD go out.
 */
export function createReportGate(max = MAX_REPORTS_PER_LOAD) {
  const seen = new Set<string>()
  return (event: ErrorEvent): boolean => {
    const key = `${event.kind}|${event.message}|${event.route}`
    if (seen.has(key) || seen.size >= max) return false
    seen.add(key)
    return true
  }
}
