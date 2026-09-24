import { useState } from 'react'
import { ChevronDown, TrendingDown } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Treemap, type TreemapNode } from 'recharts'
import { formatCurrency, cn } from '@/lib/utils'
import {
  previewOther,
  rollupBreakdown,
  type CategorySlice,
  type OtherSlice,
} from '@/lib/categoryBreakdown'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DASHBOARD_CHART_TOOLTIP_STYLE } from '@/components/dashboard/chartTooltipStyle'

type View = 'ranked' | 'grouped' | 'treemap'

const OTHER_COLOR = 'var(--muted-foreground)'
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring'

function formatShare(share: number) {
  if (share > 0 && share < 0.01) return '<1%'
  return `${Math.round(share * 100)}%`
}

function Meter({ value, max, color, thin }: { value: number; max: number; color: string; thin?: boolean }) {
  return (
    <div className={cn('rounded-full bg-muted overflow-hidden', thin ? 'h-1' : 'h-2')}>
      <div
        className="h-full rounded-full transition-all duration-(--dur-meter)"
        style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, background: color }}
      />
    </div>
  )
}

function BarRow({ slice, max, currency }: { slice: CategorySlice; max: number; currency: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_auto_2.5rem] items-center gap-3">
      <div className="flex items-center gap-1.5 min-w-0">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: slice.color }} />
        <span className="text-xs font-medium truncate">{slice.name}</span>
      </div>
      <Meter value={slice.amount} max={max} color={slice.color} />
      <span className="text-xs tabular-nums shrink-0">{formatCurrency(slice.amount, currency)}</span>
      <span className="text-xs tabular-nums text-muted-foreground text-right">{formatShare(slice.share)}</span>
    </div>
  )
}

function SubcategoryRows({ slice, currency }: { slice: CategorySlice; currency: string }) {
  // A category with no subcategories at all has nothing to group.
  if (slice.subcategories.length === 1 && slice.subcategories[0].key === '__none__') return null
  const max = slice.subcategories[0]?.amount ?? 0
  return (
    <div className="flex flex-col gap-1.5 pl-5 border-l border-border/60 ml-1">
      {slice.subcategories.map((sub) => (
        <div key={sub.key} className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_auto_2.5rem] items-center gap-3">
          <span className="text-[0.6875rem] text-muted-foreground truncate">{sub.name}</span>
          <Meter value={sub.amount} max={max} color={slice.color} thin />
          <span className="text-[0.6875rem] tabular-nums text-muted-foreground">{formatCurrency(sub.amount, currency)}</span>
          <span className="text-[0.6875rem] tabular-nums text-muted-foreground text-right">{formatShare(sub.share)}</span>
        </div>
      ))}
    </div>
  )
}

function OtherRow({ other, max, currency }: { other: OtherSlice; max: number; currency: string }) {
  const [open, setOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const { shown, more } = previewOther(other)
  const visible = showAll ? other.rows : shown

  return (
    <div className="rounded-lg border border-border/60">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_auto_2.5rem] items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors duration-(--dur-base) hover:bg-muted/40',
          FOCUS_RING,
        )}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <ChevronDown
            className={cn('w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform duration-(--dur-base)', open ? '' : '-rotate-90')}
          />
          <span className="text-xs font-medium truncate">Other · {other.count} categories</span>
        </span>
        <Meter value={other.amount} max={max} color={OTHER_COLOR} />
        <span className="text-xs tabular-nums">{formatCurrency(other.amount, currency)}</span>
        <span className="text-xs tabular-nums text-muted-foreground text-right">{formatShare(other.share)}</span>
      </button>
      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5 px-3 pb-3 pt-1">
          {visible.map((slice) => (
            <div key={slice.key} className="flex items-center justify-between gap-2 min-w-0">
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: slice.color }} />
                <span className="text-[0.6875rem] text-muted-foreground truncate">{slice.name}</span>
              </span>
              <span className="text-[0.6875rem] tabular-nums shrink-0">{formatCurrency(slice.amount, currency)}</span>
            </div>
          ))}
          {more && !showAll && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className={cn('flex items-center justify-between gap-2 rounded text-left hover:text-foreground', FOCUS_RING)}
            >
              <span className="text-[0.6875rem] text-muted-foreground underline underline-offset-2">{more.count} more</span>
              <span className="text-[0.6875rem] tabular-nums">{formatCurrency(more.amount, currency)}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function RankedBars({
  top,
  other,
  currency,
  grouped,
}: {
  top: CategorySlice[]
  other: OtherSlice | null
  currency: string
  grouped: boolean
}) {
  const max = Math.max(top[0]?.amount ?? 0, other?.amount ?? 0)
  return (
    <div className="flex flex-col gap-2.5">
      {top.map((slice) => (
        <div key={slice.key} className="flex flex-col gap-1.5">
          <BarRow slice={slice} max={max} currency={currency} />
          {grouped && <SubcategoryRows slice={slice} currency={currency} />}
        </div>
      ))}
      {other && <OtherRow other={other} max={max} currency={currency} />}
    </div>
  )
}

function TreemapCell(node: TreemapNode) {
  if (node.depth !== 1) return <g />
  const { x, y, width, height, name } = node
  const color = node.color as string
  const showLabel = width > 64 && height > 28
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={color} stroke="var(--card)" strokeWidth={2} rx={4} />
      {showLabel && (
        <text
          x={x + 6}
          y={y + 16}
          fontSize={11}
          fontWeight={500}
          fill="white"
          stroke="rgba(0,0,0,0.35)"
          strokeWidth={2}
          paintOrder="stroke"
        >
          {name.length > width / 7 ? `${name.slice(0, Math.max(1, Math.floor(width / 7) - 1))}…` : name}
        </text>
      )}
    </g>
  )
}

function CategoryTreemap({ rows, currency }: { rows: CategorySlice[]; currency: string }) {
  const data = rows.map((r) => ({ name: r.name, value: r.amount, color: r.color }))
  const summary = rows
    .slice(0, 5)
    .map((r) => `${r.name} ${formatShare(r.share)}`)
    .join(', ')
  return (
    <div className="h-72" role="img" aria-label={`Treemap of ${rows.length} categories. Largest: ${summary}.`}>
      <ResponsiveContainer width="100%" height="100%">
        <Treemap data={data} dataKey="value" nameKey="name" content={TreemapCell} isAnimationActive={false}>
          <Tooltip
            formatter={(value) => formatCurrency(value as number, currency)}
            contentStyle={DASHBOARD_CHART_TOOLTIP_STYLE}
          />
        </Treemap>
      </ResponsiveContainer>
    </div>
  )
}

function CategoryPie({ rows, currency }: { rows: CategorySlice[]; currency: string }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="sm:w-[45%]">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={rows}
              dataKey="amount"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={78}
              strokeWidth={2}
              stroke="var(--card)"
            >
              {rows.map((slice) => (
                <Cell key={slice.key} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatCurrency(value as number, currency)}
              contentStyle={DASHBOARD_CHART_TOOLTIP_STYLE}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        {rows.map((slice) => (
          <div key={slice.key} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: slice.color }} />
            <span className="text-xs font-medium truncate flex-1">{slice.name}</span>
            <span className="text-xs tabular-nums shrink-0">{formatCurrency(slice.amount, currency)}</span>
            <span className="text-xs tabular-nums text-muted-foreground w-10 text-right shrink-0">{formatShare(slice.share)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CategoryBreakdownCard({
  rows,
  loading,
  currency,
}: {
  rows: CategorySlice[]
  loading: boolean
  currency: string
}) {
  const [view, setView] = useState<View>('ranked')
  const { mode, total, top, other } = rollupBreakdown(rows)

  return (
    // The card is the Tabs root so the view switch owns a real tab panel.
    <Tabs
      value={view}
      onValueChange={(value) => setView(value as View)}
      className="rounded-[20px] border border-border bg-card p-4 flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-[0.6875rem] font-medium uppercase tracking-widest text-muted-foreground">
            Spending by category
          </p>
          {!loading && rows.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {rows.length} {rows.length === 1 ? 'category' : 'categories'} with activity
            </p>
          )}
        </div>
        {!loading && mode === 'ranked' && (
          <TabsList className="h-8" aria-label="Category breakdown view">
            <TabsTrigger value="ranked" className="text-xs h-7 px-3">Ranked</TabsTrigger>
            <TabsTrigger value="grouped" className="text-xs h-7 px-3">Grouped</TabsTrigger>
            <TabsTrigger value="treemap" className="text-xs h-7 px-3">Treemap</TabsTrigger>
          </TabsList>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={TrendingDown} title="No expenses in this period" bare />
      ) : (
        <>
          {mode === 'pie' ? (
            <CategoryPie rows={top} currency={currency} />
          ) : (
            <TabsContent value={view}>
              {view === 'treemap' ? (
                <CategoryTreemap rows={rows} currency={currency} />
              ) : (
                <RankedBars top={top} other={other} currency={currency} grouped={view === 'grouped'} />
              )}
            </TabsContent>
          )}
          <div className="flex items-center justify-between border-t border-border/60 pt-3">
            <span className="text-xs font-medium text-muted-foreground">Total expenses</span>
            <span className="text-[0.8125rem] font-bold tabular-nums">{formatCurrency(total, currency)}</span>
          </div>
        </>
      )}
    </Tabs>
  )
}
