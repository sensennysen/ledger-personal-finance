import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import type { DashboardExpenseCategoryBreakdown } from '@/hooks/useDashboardData'
import { DashboardCardHeader } from '@/components/dashboard/DashboardCardHeader'
import { InteractiveRow } from '@/components/ui/interactive-row'
import { Skeleton } from '@/components/ui/skeleton'
import { DASHBOARD_CHART_TOOLTIP_STYLE } from '@/components/dashboard/chartTooltipStyle'
import { useCategoryInk } from '@/hooks/useCategoryInk'
import { rollupBreakdown, type CategorySlice } from '@/lib/categoryBreakdown'
import { RankedBars } from '@/components/reports/CategoryBreakdownCard'

interface DashboardCategoryPieCardProps {
  expensesByCategory: DashboardExpenseCategoryBreakdown[]
  monthLabel: string
  currency: string
  loading: boolean
  onClick: () => void
  style?: React.CSSProperties
}

export function DashboardCategoryPieCard({
  expensesByCategory,
  monthLabel,
  currency,
  loading,
  onClick,
  style,
}: DashboardCategoryPieCardProps) {
  const ink = useCategoryInk()
  // Same rule as Reports (spec §7 V4): a pie up to 12 categories, ranked bars with an Other row above.
  const rollup = useMemo(() => {
    const total = expensesByCategory.reduce((sum, c) => sum + c.amount, 0)
    const slices: CategorySlice[] = expensesByCategory.map((c, index) => ({
      key: `${index}:${c.name}`,
      name: c.name,
      color: ink(c.color),
      amount: c.amount,
      share: total > 0 ? c.amount / total : 0,
      subcategories: [],
    }))
    return rollupBreakdown(slices)
  }, [expensesByCategory, ink])
  const ariaLabel = `View expenses by category for ${monthLabel}`
  const header = (
    <DashboardCardHeader
      title="Expenses by Category"
      subtitle={`${monthLabel} spending breakdown`}
      action={<ChevronRight className="w-4 h-4 text-muted-foreground/50 mt-0.5" />}
    />
  )

  // Ranked mode holds a button of its own (the Other row), so only the header opens the details;
  // a button inside a button is not valid.
  if (!loading && rollup.mode === 'ranked') {
    return (
      <div className="w-full rounded-[20px] border border-border p-4 md:p-5 bg-card" style={style}>
        <InteractiveRow
          as="button"
          aria-label={ariaLabel}
          className="w-full text-left rounded-lg cursor-pointer transition-colors duration-(--dur-base) hover:bg-elevated focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
          onActivate={onClick}
        >
          {header}
        </InteractiveRow>
        <RankedBars top={rollup.top} other={rollup.other} currency={currency} grouped={false} resetKey={monthLabel} />
      </div>
    )
  }

  return (
    <InteractiveRow
      as="button"
      aria-label={ariaLabel}
      className="w-full text-left rounded-[20px] border border-border p-4 md:p-5 bg-card cursor-pointer transition-colors duration-(--dur-base) hover:bg-elevated focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
      style={style}
      onActivate={onClick}
    >
      {header}
      {loading ? (
        <Skeleton className="h-56 w-full" />
      ) : expensesByCategory.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No expenses for {monthLabel}</p>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex justify-center sm:block sm:w-[50%]">
            <div className="h-[200px] 2xl:h-[168px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expensesByCategory}
                  dataKey="amount"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={78}
                  strokeWidth={2}
                  stroke="var(--card)"
                >
                  {expensesByCategory.map((entry, index) => (
                    <Cell key={index} fill={ink(entry.color)} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatCurrency(value as number, currency)}
                  contentStyle={DASHBOARD_CHART_TOOLTIP_STYLE}
                />
              </PieChart>
            </ResponsiveContainer>
            </div>
          </div>
          <div className="flex-1 space-y-1.5 min-w-0">
            {expensesByCategory.map((category, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ink(category.color) }} aria-hidden />
                <span className="text-base">{category.icon}</span>
                <span className="truncate flex-1 text-xs text-muted-foreground">{category.name}</span>
                <span className="money text-xs font-medium shrink-0 text-foreground">
                  {formatCurrency(category.amount, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </InteractiveRow>
  )
}
