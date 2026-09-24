import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Rows3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatNet } from '@/lib/formatNet'
import type { TxSort } from '@/lib/transactionWindow'

type Density = 'comfortable' | 'compact'

function sumColor(sum: Record<string, number>): string {
  const values = Object.values(sum).filter((v) => v !== 0)
  if (values.length > 0 && values.every((v) => v < 0)) return 'text-expense'
  if (values.length > 0 && values.every((v) => v > 0)) return 'text-income'
  return 'text-foreground'
}

/**
 * Sticky result bar above a transaction list (spec §7 V2): match count, total,
 * active range and the sum of the match, with sort and density controls.
 * Counts and sums describe the whole filtered set, not the rendered window.
 */
export function ResultBar({
  matchCount,
  total,
  totalLabel,
  rangeLabel,
  sum,
  sort,
  onSortChange,
  density,
  onDensityChange,
  compact,
}: {
  matchCount: number
  total: number
  totalLabel: string
  rangeLabel: string | null
  sum: Record<string, number>
  sort: TxSort
  onSortChange: (sort: TxSort) => void
  density: Density
  onDensityChange: (density: Density) => void
  compact: boolean
}) {
  const nextSort: TxSort = sort === 'newest' ? 'oldest' : 'newest'
  const SortIcon = sort === 'newest' ? ArrowDownWideNarrow : ArrowUpNarrowWide
  const sortLabel = sort === 'newest' ? 'Newest first' : 'Oldest first'

  return (
    <div className="relative -mx-4 flex items-center justify-between gap-3 border-y border-border bg-muted px-4 py-2 md:-mx-6 md:px-6">
      <span aria-hidden className="absolute inset-x-0 -top-px h-0.5 bg-primary" />
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-0.5">
        <span className="text-sm font-bold">
          <span className="money">{matchCount.toLocaleString()}</span> {compact ? 'match' : `transaction${matchCount === 1 ? '' : 's'} match`}
        </span>
        {!compact && (
          <span className="text-xs text-muted-foreground">
            of <span className="money">{total.toLocaleString()}</span> {totalLabel}
            {rangeLabel ? ` · ${rangeLabel}` : ''}
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          Sum <span className={`money font-bold ${sumColor(sum)}`}>{formatNet(sum)}</span>
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => onSortChange(nextSort)}
          aria-label={`Sorted ${sortLabel.toLowerCase()}; switch to ${nextSort} first`}
          title={`Switch to ${nextSort} first`}
        >
          <SortIcon className="w-3.5 h-3.5" />
          {!compact && <span>{sortLabel}</span>}
        </Button>
        {!compact && (
          <Button
            variant={density === 'compact' ? 'secondary' : 'ghost'}
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => onDensityChange(density === 'compact' ? 'comfortable' : 'compact')}
            aria-pressed={density === 'compact'}
          >
            <Rows3 className="w-3.5 h-3.5" />
            <span>Compact</span>
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * Wraps a result bar and its list, publishing the bar's height as
 * `--tx-list-sticky-top` so day headers stick directly beneath it.
 */
export function ResultBarLayout({ bar, children }: { bar: ReactNode; children: ReactNode }) {
  const [barNode, setBarNode] = useState<HTMLDivElement | null>(null)
  const [barHeight, setBarHeight] = useState(0)

  useEffect(() => {
    if (!barNode) return
    const sync = () => setBarHeight(barNode.getBoundingClientRect().height)
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(barNode)
    return () => observer.disconnect()
  }, [barNode])

  return (
    <div style={{ '--tx-list-sticky-top': `${barHeight}px` } as CSSProperties}>
      <div ref={setBarNode} className="sticky top-0 z-20">{bar}</div>
      <div className="pt-3">{children}</div>
    </div>
  )
}
