import { useEffect, useRef } from 'react'
import { Undo2, X } from 'lucide-react'

interface UndoToastProps {
  message: string
  duration?: number
  onUndo: () => void
  onDismiss: () => void
}

export function UndoToast({ message, duration = 5000, onUndo, onDismiss }: UndoToastProps) {
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const start = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - start
      const pct = Math.max(0, 100 - (elapsed / duration) * 100)
      if (barRef.current) barRef.current.style.width = `${pct}%`
      if (pct === 0) clearInterval(interval)
    }, 40)

    const timer = setTimeout(onDismiss, duration)

    return () => {
      clearInterval(interval)
      clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration])

  return (
    <div className="fixed bottom-18 md:bottom-4 left-1/2 -translate-x-1/2 z-50 w-[min(calc(100vw-2rem),380px)] pointer-events-auto">
      <div className="bg-foreground text-background rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3">
          <span className="flex-1 text-sm font-medium">{message}</span>
          <button
            onClick={onUndo}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-foreground bg-white/15 hover:bg-white/25 transition-colors px-2.5 py-1 rounded-md shrink-0"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Undo
          </button>
          <button
            onClick={onDismiss}
            className="text-background/50 hover:text-background transition-colors shrink-0 ml-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div ref={barRef} className="h-0.5 bg-primary w-full transition-none" />
      </div>
    </div>
  )
}
