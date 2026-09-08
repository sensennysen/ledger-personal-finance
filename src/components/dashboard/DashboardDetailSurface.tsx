import { createContext, useContext, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const PaneContext = createContext<{ pane: boolean; close: () => void }>({
  pane: false,
  close: () => {},
})
export function DetailSurface({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}) {
  const pane = useMediaQuery('(min-width: 1024px)')
  useEffect(() => {
    if (!open || !pane) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, pane, onOpenChange])
  return (
    <PaneContext.Provider value={{ pane, close: () => onOpenChange(false) }}>
      {pane ? (
        open ? (
          children
        ) : null
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
          {children}
        </Dialog>
      )}
    </PaneContext.Provider>
  )
}
export function DetailContent({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const { pane, close } = useContext(PaneContext)
  const target = document.getElementById('dashboard-detail-pane')
  if (!pane)
    return <DialogContent className={className}>{children}</DialogContent>
  if (!target) return null
  return createPortal(
    <aside
      aria-label="Dashboard details"
      className="animate-page-in relative w-[340px] border-l border-border bg-sidebar p-5 pt-6 space-y-5 overflow-y-auto"
    >
      <Button
        autoFocus
        variant="ghost"
        size="icon"
        aria-label="Close details"
        onClick={close}
        className="absolute top-2 right-2"
      >
        <X />
      </Button>
      {children}
    </aside>,
    target,
  )
}
export function DetailTitle({ children }: { children: React.ReactNode }) {
  const { pane } = useContext(PaneContext)
  return pane ? (
    <h2 className="text-base font-medium pr-8">{children}</h2>
  ) : (
    <DialogTitle>{children}</DialogTitle>
  )
}
