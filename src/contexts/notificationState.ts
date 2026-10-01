import { createContext, useContext } from 'react'
import type { NotificationInput } from '@/lib/notifications'

export type Notify = (input: NotificationInput) => void

export const NotificationContext = createContext<Notify | null>(null)

/** Reports an outcome on the app's one notification surface. */
export function useNotify(): Notify {
  const notify = useContext(NotificationContext)
  if (!notify) throw new Error('useNotify must be used inside NotificationProvider')
  return notify
}
