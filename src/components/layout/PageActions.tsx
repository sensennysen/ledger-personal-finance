import { useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { PAGE_ACTIONS_ID } from '@/lib/pageChrome'

// Renders children into the shell's row-2 action slot, so a page keeps its
// own handlers and dialog state while the buttons sit in the header. Below
// md the header row is hidden, so the actions stay inline where they were,
// unless the page only ever showed them on desktop (desktopOnly).
export function PageActions({
  children,
  desktopOnly = false,
}: {
  children: ReactNode
  desktopOnly?: boolean
}) {
  const wide = useMediaQuery('(min-width: 768px)')
  const target = useSyncExternalStore(
    () => () => {},
    () => document.getElementById(PAGE_ACTIONS_ID),
    () => null,
  )
  if (!wide) return desktopOnly ? null : <>{children}</>
  return target ? createPortal(children, target) : null
}
