import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowDown10, ArrowDownWideNarrow, ArrowUp01, ArrowUpNarrowWide, Bookmark, CheckSquare, Download, EllipsisVertical, Rows3, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
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
 * Sticky result bar above a transaction list (spec §7 V2): match count, total
 * and the net of the match, with sort and density controls.
 * Counts and sums describe the whole filtered set, not the rendered window.
 */
export function ResultBar({
  matchCount,
  total,
  totalLabel,
  sum,
  sort,
  onSortChange,
  sortOptions = DATE_SORTS,
  density,
  onDensityChange,
  onExport,
  savedFilters,
  onSelect,
  selecting = false,
  onImport,
  compact,
}: {
  matchCount: number
  total: number
  /** Follows the count when nothing narrows the list, e.g. "this cycle"; empty for none. */
  totalLabel: string
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
  /** Phone overflow menu (M-05): bulk select and CSV import. */
  onSelect?: () => void
  selecting?: boolean
  onImport?: () => void
  compact: boolean
}) {
  const { label: sortLabel, icon: SortIcon } = SORT_OPTIONS[sort]
  const sortMenu = (triggerClassName: string, iconClassName: string) => (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={triggerClassName}
        aria-label={`Sorted ${sortLabel.toLowerCase()}; change sort`}
        title="Change sort"
      >
        <SortIcon className={iconClassName} />
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
  )
  const showSavedFilters = savedFilters && (savedFilters.canSave || savedFilters.count > 0)
  // One line on every width (density pass 2a): the count, "of N" only when narrowed, and the net.
  const summary = (
    <p className={`min-w-0 truncate text-muted-foreground ${compact ? 'text-[0.8125rem]' : 'text-sm'}`}>
      <b className="money font-semibold text-foreground">{matchCount.toLocaleString()}</b>
      {matchCount === total ? (totalLabel ? ` ${totalLabel}` : '') : ` of ${total.toLocaleString()}`} ·{' '}
      <span className={`money font-medium ${sumColor(sum)}`}>{formatNet(sum)}</span>
    </p>
  )

  if (compact) {
    // Phones (M-05): one plain line, sort, and every list action behind ⋯, labelled.
    const iconTrigger = buttonVariants({ variant: 'ghost', size: 'icon', className: '[&_svg]:size-[18px]' })
    const hasOverflow = onSelect || showSavedFilters || onExport || onImport
    return (
      <div className="-mr-2 flex items-center justify-between gap-2 bg-background py-0.5">
        {summary}
        <div className="flex shrink-0">
          {sortMenu(iconTrigger, '')}
          {hasOverflow && (
            <DropdownMenu>
              <DropdownMenuTrigger className={iconTrigger} aria-label="More list actions">
                <EllipsisVertical />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {onSelect && (
                  <DropdownMenuCheckboxItem checked={selecting} onCheckedChange={onSelect} closeOnClick>
                    <CheckSquare className="text-muted-foreground" />
                    Select multiple
                  </DropdownMenuCheckboxItem>
                )}
                {showSavedFilters && (
                  <DropdownMenuItem onClick={savedFilters.onOpen}>
                    <Bookmark className="text-muted-foreground" />
                    {savedFilters.canSave ? 'Save filter' : `Saved filters · ${savedFilters.count}`}
                  </DropdownMenuItem>
                )}
                {onExport && (
                  <DropdownMenuItem onClick={onExport} disabled={matchCount === 0}>
                    <Download className="text-muted-foreground" />
                    Export
                  </DropdownMenuItem>
                )}
                {onImport && (
                  <DropdownMenuItem onClick={onImport}>
                    <Upload className="text-muted-foreground" />
                    Import CSV
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted px-4 py-2">
      {summary}
      <div className="flex shrink-0 items-center gap-1">
        {sortMenu(buttonVariants({ variant: 'ghost', size: 'sm', className: 'gap-1.5 text-xs' }), 'w-3.5 h-3.5')}
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
        {showSavedFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-primary"
            onClick={savedFilters.onOpen}
            aria-label={savedFilters.canSave ? 'Save this filter' : `Saved filters, ${savedFilters.count}`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>{savedFilters.canSave ? 'Save filter' : `Saved filters · ${savedFilters.count}`}</span>
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
            <span>Export</span>
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
