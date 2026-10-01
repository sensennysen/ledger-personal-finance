import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Undo2, X } from 'lucide-react'
import { announcementFor, type Notification } from '@/lib/notifications'

interface NotificationSurfaceProps {
  notification: Notification
  onDismiss: (id: number) => void
}

const ICON = {
  success: <CheckCircle2 className="w-4 h-4 shrink-0 text-income-container" />,
  failure: <AlertTriangle className="w-4 h-4 shrink-0 text-expense-container" />,
  partial: <AlertTriangle className="w-4 h-4 shrink-0 text-accent" />,
}

/**
 * The one place success, failure and partial failure are reported. The surface is
 * inverted (foreground ink), so icons use the container tones, which flip with the theme.
 */
export function NotificationSurface({ notification, onDismiss }: NotificationSurfaceProps) {
  const { id, severity, title, body, action, duration } = notification
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (duration === null) return
    const start = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - start
      const pct = Math.max(0, 100 - (elapsed / duration) * 100)
      if (barRef.current) barRef.current.style.width = `${pct}%`
      if (pct === 0) clearInterval(interval)
    }, 40)

    const timer = setTimeout(() => onDismiss(id), duration)

    return () => {
      clearInterval(interval)
      clearTimeout(timer)
    }
  }, [id, duration, onDismiss])

  return (
    <div className="fixed bottom-[calc(184px+env(safe-area-inset-bottom))] md:bottom-4 left-1/2 -translate-x-1/2 z-50 w-[min(calc(100vw-2rem),380px)] pointer-events-auto">
      <div className="bg-foreground text-background rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-start gap-2.5 px-4 py-3">
          <span className="mt-0.5">{ICON[severity]}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{title}</p>
            {body && <p className="text-xs text-background/70 mt-0.5">{body}</p>}
          </div>
          {action && (
            <button
              onClick={() => {
                onDismiss(id)
                action.run()
              }}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-foreground bg-primary-foreground/15 hover:bg-primary-foreground/25 transition-colors px-2.5 py-1 rounded-md shrink-0"
            >
              {action.label === 'Undo' && <Undo2 className="w-3.5 h-3.5" />}
              {action.label}
            </button>
          )}
          <button
            onClick={() => onDismiss(id)}
            aria-label="Dismiss"
            className="text-background/50 hover:text-background transition-colors shrink-0 ml-1 mt-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {duration !== null && <div ref={barRef} className="h-0.5 bg-primary w-full transition-none" />}
      </div>
    </div>
  )
}

/**
 * Two live regions that stay in the page for its whole life (LED-148). A region
 * inserted together with its text is skipped by some readers, so the text goes in
 * after the region exists. A failure or partial failure uses the assertive one.
 * The visible surface carries no role, so nothing is announced twice.
 */
export function NotificationAnnouncer({ notification }: { notification: Notification | null }) {
  const [announced, setAnnounced] = useState<number | null>(null)

  useEffect(() => {
    if (!notification) return
    const { id } = notification
    const timer = setTimeout(() => setAnnounced(id), 50)
    return () => clearTimeout(timer)
  }, [notification])

  const text = notification && announced === notification.id ? announcementFor(notification) : ''
  const assertive = notification?.role === 'alert'
  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{assertive ? '' : text}</div>
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">{assertive ? text : ''}</div>
    </>
  )
}
