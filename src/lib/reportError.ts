import { supabase } from '@/lib/supabase'
import { buildErrorEvent, createReportGate, shouldReport, type ErrorKind } from '@/lib/errorReport'

// Sends a failure to `error_events` for the operator (LED-258). Fire and forget: a report that
// cannot be sent is logged and dropped, never thrown, and never reported itself.

const RELEASE = (import.meta.env.VITE_RELEASE as string | undefined) ?? 'unknown'
const gate = createReportGate()

export function reportError(kind: ErrorKind, error: unknown, componentStack?: string | null): void {
  if (!shouldReport({ prod: import.meta.env.PROD, hostname: window.location.hostname })) return
  const event = buildErrorEvent(kind, error, {
    pathname: window.location.pathname,
    release: RELEASE,
    userAgent: navigator.userAgent,
  }, componentStack)
  if (!gate(event)) return
  void (async () => {
    try {
      // Reports are for signed-in users only; the table takes the owner from the session. Errors on
      // signed-out pages (/login, /privacy, /terms, /data-deletion) are not reported: taking them would
      // let anyone write to error_events (LED-279, decision B). Release checklist D7 checks them by hand.
      const { data } = await supabase.auth.getSession()
      if (!data.session) return
      const { error: insertError } = await supabase.from('error_events').insert(event)
      if (insertError) console.warn('[reportError] not sent:', insertError.message)
    } catch (sendError) {
      console.warn('[reportError] not sent:', sendError)
    }
  })()
}

/** Errors nothing caught: a thrown error outside React, or a promise rejection nobody handled. */
export function reportUncaughtErrors(): void {
  window.addEventListener('error', (event) => reportError('error', event.error ?? event.message))
  window.addEventListener('unhandledrejection', (event) => reportError('rejection', event.reason))
}
