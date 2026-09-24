import type { ReactNode, Ref } from 'react'
import { formatDate, formatDateShort, getLocalDateString } from '@/lib/utils'
import { formatNet } from '@/lib/formatNet'
import { dayLabel, type DayGroup } from '@/lib/transactionWindow'

/** Footer and scroll sentinel under a windowed list; renders nothing once every row is shown. */
export function WindowFooter({
  rendered,
  total,
  compact,
  sentinelRef,
}: {
  rendered: number
  total: number
  compact: boolean
  sentinelRef: Ref<HTMLDivElement>
}) {
  if (rendered >= total) return null
  const range = `${compact ? 'Rows' : 'Rendering rows'} 1–${rendered.toLocaleString()} of ${total.toLocaleString()}`
  return (
    <div ref={sentinelRef} className="py-3 text-center text-xs text-muted-foreground" aria-live="polite">
      {compact ? range : `${range} · scroll to load`}
    </div>
  )
}

/**
 * Day-grouped transaction list. Headers stick below `--tx-list-sticky-top`
 * (the height of the LED-61 result bar, set by ResultBarLayout) and always carry the
 * whole day's count and net, even when the window cuts the day short.
 */
export function TransactionDayList<T extends { id: string }>({
  groups,
  renderRow,
  compact,
}: {
  groups: DayGroup<T>[]
  renderRow: (tx: T) => ReactNode
  compact: boolean
}) {
  const today = getLocalDateString()
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.date} aria-label={formatDate(group.date)}>
          <div className="sticky top-[var(--tx-list-sticky-top,0px)] z-10 -mx-1 mb-2 flex items-center justify-between gap-3 bg-background/95 px-1 py-1.5 backdrop-blur-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {dayLabel(group.date, today, { short: formatDateShort, full: formatDate })}
            </p>
            <p className="money text-xs text-muted-foreground">
              {compact
                ? formatNet(group.net)
                : `${group.count} item${group.count === 1 ? '' : 's'} · ${formatNet(group.net)}`}
            </p>
          </div>
          <div className="space-y-1">{group.items.map(renderRow)}</div>
        </section>
      ))}
    </div>
  )
}
