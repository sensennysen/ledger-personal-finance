import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowDown10, ArrowDownWideNarrow, ArrowUp01, ArrowUpNarrowWide, Bookmark, Download, Rows3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatNet } from '@/lib/formatNet'
import type { ActivitySort, TxSort } from '@/lib/transactionWindow'

type Density = 'comfortable' | 'compact'

const SORT_OPTIONS: Record<ActivitySort, { label: string; icon: typeof ArrowDownWideNarrow }> = {
  newest: { label: 'Newest first', icon: ArrowDownWideNarrow },
  oldest: { label: 'Oldest first', icon: ArrowUpNarrowWide },
  largest: { label: 'Largest first', icon: ArrowDown10 },
  smallest: { label: 'Smallest first', icon: ArrowUp01 },
}

const DATE_SORTS: readonly TxSort[] = ['newest', 'oldest']

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
  sortOptions = DATE_SORTS,
  density,
  onDensityChange,
  onExport,
  savedFilters,
  compact,
}: {
  matchCount: number
  total: number
  totalLabel: string
  rangeLabel: string | null
  sum: Record<string, number>
  sort: ActivitySort
  onSortChange: (sort: ActivitySort) => void
  /** The sorts offered: dates only unless the page lists amounts flat (Activity, LED-241). */
  sortOptions?: readonly ActivitySort[]
  density: Density
  onDensityChange: (density: Density) => void
  /** Downloads the matching rows as CSV (29a "Export match"). */
  onExport?: () => void
  /** Saved filters (29a): "Save filter" while a filter narrows the list, else the saved list. */
  savedFilters?: { count: number; canSave: boolean; onOpen: () => void }
  compact: boolean
}) {
  const { label: sortLabel, icon: SortIcon } = SORT_OPTIONS[sort]

  return (
    <div className="relative -mx-4 flex items-center justify-between gap-3 border-y border-border bg-muted px-4 py-2 md:-mx-6 md:px-6">
      <span aria-hidden className="absolute inset-x-0 -top-px h-0.5 bg-primary" />
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-0.5">
        <span className="text-sm font-bold">
          <span className="money">{matchCount.toLocaleString()}</span>{' '}
          {compact ? (matchCount === 1 ? 'match' : 'matches') : `transaction${matchCount === 1 ? '' : 's'} match`}
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
        <DropdownMenu>
          <DropdownMenuTrigger
            className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'gap-1.5 text-xs' })}
            aria-label={`Sorted ${sortLabel.toLowerCase()}; change sort`}
            title="Change sort"
          >
            <SortIcon className="w-3.5 h-3.5" />
            {!compact && <span>{sortLabel}</span>}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuRadioGroup value={sort} onValueChange={(value) => onSortChange(value as ActivitySort)}>
              {sortOptions.map((option) => {
                const { label, icon: Icon } = SORT_OPTIONS[option]
                return (
                  <DropdownMenuRadioItem key={option} value={option} closeOnClick>
                    <Icon className="text-muted-foreground" />
                    {label}
                  </DropdownMenuRadioItem>
                )
              })}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
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
        {savedFilters && (savedFilters.canSave || savedFilters.count > 0) && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-primary"
            onClick={savedFilters.onOpen}
            aria-label={savedFilters.canSave ? 'Save this filter' : `Saved filters, ${savedFilters.count}`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            {!compact && <span>{savedFilters.canSave ? 'Save filter' : `Saved filters · ${savedFilters.count}`}</span>}
          </Button>
        )}
        {onExport && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-primary"
            onClick={onExport}
            disabled={matchCount === 0}
            aria-label={`Export ${matchCount.toLocaleString()} matching transactions as CSV`}
          >
            <Download className="w-3.5 h-3.5" />
            {!compact && <span>Export match</span>}
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
