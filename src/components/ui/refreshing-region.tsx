import { cn } from '@/lib/utils'

/**
 * Keeps content mounted (and its scroll position) while newer data loads:
 * dims it, draws a progress rule and names what is loading. Only for
 * refetches — a first load with nothing on screen still uses a skeleton.
 */
export function RefreshingRegion({
  refreshing,
  label,
  className,
  style,
  children,
}: {
  refreshing: boolean
  /** What is loading, e.g. "Loading October 2026…". */
  label: string
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  return (
    <div className={cn('relative', className)} style={style} aria-busy={refreshing || undefined}>
      {refreshing && (
        <div className="mb-3 space-y-1.5">
          <div className="relative h-0.5 overflow-hidden rounded-full bg-muted">
            <div className="progress-rule absolute inset-y-0 left-0 w-2/5 rounded-full bg-primary" />
          </div>
          <p role="status" className="text-xs text-muted-foreground">
            {label}
          </p>
        </div>
      )}
      <div
        className={cn(
          'transition-opacity duration-[var(--dur-fast)]',
          refreshing && 'pointer-events-none opacity-60',
        )}
      >
        {children}
      </div>
    </div>
  )
}
