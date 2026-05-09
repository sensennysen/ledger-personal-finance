import { ChevronRight } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import type { DashboardExpenseCategoryBreakdown } from '@/hooks/useDashboardData'
import { DashboardCardHeader } from '@/components/dashboard/DashboardCardHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { DASHBOARD_CHART_TOOLTIP_STYLE } from '@/components/dashboard/chartTooltipStyle'

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
  return (
    <div
      className="rounded-xl border border-border/60 p-5 bg-card cursor-pointer transition-shadow duration-300 hover:shadow-[0_4px_24px_oklch(0_0_0/25%)]"
      style={style}
      onClick={onClick}
    >
      <DashboardCardHeader
        title="Expenses by Category"
        subtitle={`${monthLabel} spending breakdown`}
        action={<ChevronRight className="w-4 h-4 text-muted-foreground/50 mt-0.5" />}
      />
      {loading ? (
        <Skeleton className="h-56 w-full" />
      ) : expensesByCategory.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No expenses for {monthLabel}</p>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex justify-center sm:block sm:w-[50%]">
            <ResponsiveContainer width="100%" height={200}>
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
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatCurrency(value as number, currency)}
                  contentStyle={DASHBOARD_CHART_TOOLTIP_STYLE}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-1.5 min-w-0">
            {expensesByCategory.map((category, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <span className="text-base">{category.icon}</span>
                <span className="truncate flex-1 text-xs text-muted-foreground">{category.name}</span>
                <span className="money text-xs font-medium shrink-0" style={{ color: category.color }}>
                  {formatCurrency(category.amount, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
