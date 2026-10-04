import { useState, type ReactNode } from 'react'
import { CalendarRange } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatNet } from '@/lib/formatNet'
import type { MonthNet } from '@/lib/monthJump'
import { cn } from '@/lib/utils'

const RAIL_HEAD = 5

function monthLabel(key: string): string {
  return new Date(key + '-01T00:00:00').toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

function MonthList({
  months,
  activeKey,
  onPick,
}: {
  months: MonthNet[]
  activeKey: string | null
  onPick: (key: string) => void
}) {
  return (
    <ul className="divide-y divide-border">
      {months.map((month) => {
        const active = month.key === activeKey
        return (
          <li key={month.key}>
            <button
              type="button"
              onClick={() => onPick(month.key)}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition-colors',
                active ? 'bg-accent font-bold text-accent-foreground' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <span className={cn('shrink-0 whitespace-nowrap', !active && 'text-foreground/80')}>{monthLabel(month.key)}</span>
              <span className="money text-right">{month.count === 0 ? '—' : formatNet(month.net)}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Desktop month rail (spec §7 V3): the newest months with their net, the rest
 * behind an "N earlier months" row. The period stepper stays for single steps.
 */
export function MonthRail({
  months,
  activeKey,
  onPick,
  footer,
}: {
  months: MonthNet[]
  activeKey: string | null
  onPick: (key: string) => void
  /** Sits under the month list, e.g. "Top categories, this filter". */
  footer?: ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  const activeIndex = activeKey ? months.findIndex((m) => m.key === activeKey) : -1
  // Keep the active month visible even when it sits among the earlier ones.
  const showAll = expanded || activeIndex >= RAIL_HEAD
  const shown = showAll ? months : months.slice(0, RAIL_HEAD)
  const hidden = months.length - shown.length

  return (
    <aside aria-label="Month jump" className="sticky top-4 hidden w-64 shrink-0 self-start lg:block">
      <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Month jump</p>
      <div className="overflow-hidden rounded-md border border-border bg-card">
        <div className={cn(showAll && 'max-h-[60vh] overflow-y-auto')}>
          <MonthList months={shown} activeKey={activeKey} onPick={onPick} />
        </div>
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="w-full border-t border-border px-3 py-2 text-center text-xs font-semibold text-primary hover:bg-muted"
          >
            {hidden} earlier month{hidden === 1 ? '' : 's'}
          </button>
        )}
      </div>
      {footer}
    </aside>
  )
}

/** Phones: the month list in a bottom sheet, opened from the cycle dates (M-04). */
export function MonthJumpSheet({
  open,
  onOpenChange,
  months,
  activeKey,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  months: MonthNet[]
  activeKey: string | null
  onPick: (key: string) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80dvh] pb-[env(safe-area-inset-bottom)]">
        <SheetHeader>
          <SheetTitle>Jump to month</SheetTitle>
          <SheetDescription>Each month with its net.</SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto border-t border-border">
          <MonthList
            months={months}
            activeKey={activeKey}
            onPick={(key) => {
              onOpenChange(false)
              onPick(key)
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** Account pages below lg: a bottom-bar action that opens the month sheet. */
export function MonthJumpBar({
  months,
  activeKey,
  onPick,
}: {
  months: MonthNet[]
  activeKey: string | null
  onPick: (key: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* <main>'s bottom padding already clears the fixed BottomNav and a sticky offset is measured
          inside that padding, so bottom-0 sits the bar on the nav. An extra 88px floated it 88px
          above the nav (LED-149, measured at 390x844). */}
      <div data-month-jump-bar className="sticky bottom-0 z-20 -mx-4 flex h-14 items-center gap-5 border-t border-border bg-muted px-4 md:-mx-6 md:px-6 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 text-xs font-semibold text-primary"
        >
          <CalendarRange className="size-4" />
          Jump to month
        </button>
      </div>
      <MonthJumpSheet open={open} onOpenChange={setOpen} months={months} activeKey={activeKey} onPick={onPick} />
    </>
  )
}
