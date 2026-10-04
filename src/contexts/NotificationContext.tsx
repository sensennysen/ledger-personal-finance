import { useCallback, useRef, useState } from 'react'
import { NotificationAnnouncer, NotificationSurface } from '@/components/ui/notification'
import {
  createNotification,
  dismissNotification,
  type Notification,
  type NotificationInput,
} from '@/lib/notifications'
import { NotificationContext } from './notificationState'

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<Notification | null>(null)
  const nextId = useRef(0)

  const notify = useCallback((input: NotificationInput) => {
    nextId.current += 1
    setCurrent(createNotification(input, nextId.current))
  }, [])

  const dismiss = useCallback((id: number) => {
    setCurrent((previous) => dismissNotification(previous, id))
  }, [])

  return (
    <NotificationContext.Provider value={notify}>
      {children}
      <NotificationAnnouncer notification={current} />
      {current && <NotificationSurface key={current.id} notification={current} onDismiss={dismiss} />}
    </NotificationContext.Provider>
  )
}
