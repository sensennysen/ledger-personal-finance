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

/** The phone list's card: one per day, or one around a flat list (M-06). */
export function DayCard({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-[20px] border border-border bg-card">{children}</div>
}

/** Desktop Compact (density pass 3a): one bordered surface around one-line ledger rows. */
export function TableSurface({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-xl border border-border bg-card">{children}</div>
}

/**
 * Day-grouped transaction list. Headers stick below `--tx-list-sticky-top`
 * (the height of the LED-61 result bar, set by ResultBarLayout) and always carry the
 * whole day's net, even when the window cuts the day short.
 */
export function TransactionDayList<T extends { id: string }>({
  groups,
  renderRow,
  compact,
  table = false,
}: {
  groups: DayGroup<T>[]
  renderRow: (tx: T) => ReactNode
  compact: boolean
  /** Desktop Compact: each day is one table surface with its header inside. */
  table?: boolean
}) {
  const today = getLocalDateString()
  if (table) {
    return (
      <div className="space-y-3">
        {groups.map((group) => (
          <section
            key={group.date}
            aria-label={formatDate(group.date)}
            data-day={group.date}
            className="scroll-mt-[var(--tx-list-sticky-top,0px)] rounded-xl border border-border bg-card"
          >
            <div className="sticky top-[var(--tx-list-sticky-top,0px)] z-10 flex items-center justify-between gap-4 rounded-t-xl border-b border-border bg-surface px-4 py-2 text-xs font-semibold uppercase tracking-[0.04em] text-muted-foreground">
              <p>{dayLabel(group.date, today, { short: formatDateShort, full: formatDate })}</p>
              <p className="money normal-case tracking-normal">{formatNet(group.net)}</p>
            </div>
            <div className="overflow-hidden rounded-b-xl">{group.items.map(renderRow)}</div>
          </section>
        ))}
      </div>
    )
  }
  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {groups.map((group) => (
        <section
          key={group.date}
          aria-label={formatDate(group.date)}
          data-day={group.date}
          className="scroll-mt-[var(--tx-list-sticky-top,0px)]"
        >
          <div className="sticky top-[var(--tx-list-sticky-top,0px)] z-10 -mx-1 mb-2 flex items-center justify-between gap-3 bg-background/95 px-1 py-1.5 backdrop-blur-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {dayLabel(group.date, today, { short: formatDateShort, full: formatDate })}
            </p>
            <p className="money text-xs text-muted-foreground">{formatNet(group.net)}</p>
          </div>
          {compact ? (
            // Phones (M-06): one card per day, flat rows inside.
            <DayCard>{group.items.map(renderRow)}</DayCard>
          ) : (
            <div className="space-y-1">{group.items.map(renderRow)}</div>
          )}
        </section>
      ))}
    </div>
  )
}
