import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { EXPENSE, INCOME } from '@/constants/colors'
import { formatCurrency } from '@/lib/utils'
import type { DashboardCashFlowPoint, DashboardChartPeriod } from '@/hooks/useDashboardData'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DashboardCardHeader } from '@/components/dashboard/DashboardCardHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { DASHBOARD_CHART_TOOLTIP_STYLE } from '@/components/dashboard/chartTooltipStyle'

interface DashboardCashFlowChartProps {
  chartPeriod: DashboardChartPeriod
  setChartPeriod: (value: DashboardChartPeriod) => void
  cashFlowData: DashboardCashFlowPoint[]
  currency: string
  currencySymbol: string
  loading: boolean
  monthLabel: string
  style?: React.CSSProperties
}

export function DashboardCashFlowChart({
  chartPeriod,
  setChartPeriod,
  cashFlowData,
  currency,
  currencySymbol,
  loading,
  monthLabel,
  style,
}: DashboardCashFlowChartProps) {
  return (
    <div className="rounded-[20px] border border-border overflow-hidden bg-card min-w-0" style={style}>
      <div className="px-5 pt-5 pb-3">
        <DashboardCardHeader
          title="Cash Flow"
          subtitle={`Income vs expenses ending ${monthLabel}`}
          action={(
            <Tabs value={chartPeriod} onValueChange={(value) => setChartPeriod(value as DashboardChartPeriod)}>
              <TabsList className="h-8 w-full sm:w-auto">
                <TabsTrigger value="week" className="text-xs flex-1 sm:flex-none px-3">Weekly</TabsTrigger>
                <TabsTrigger value="month" className="text-xs flex-1 sm:flex-none px-3">Daily</TabsTrigger>
                <TabsTrigger value="quarterly" className="text-xs flex-1 sm:flex-none px-3">3 months</TabsTrigger>
                <TabsTrigger value="yearly" className="text-xs flex-1 sm:flex-none px-3">12 months</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          className="flex-col 2xl:flex-row 2xl:items-center mb-0"
        />
      </div>
      <div className="px-2 pb-4">
        {loading ? (
          <Skeleton className="h-60 w-full 2xl:h-48" />
        ) : (
          <div className="h-60 2xl:h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cashFlowData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                interval={chartPeriod === 'month' ? 4 : 'preserveStartEnd'}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `${currencySymbol}${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value) => formatCurrency(value as number, currency)}
                contentStyle={DASHBOARD_CHART_TOOLTIP_STYLE}
                cursor={{ stroke: 'var(--primary)', strokeWidth: 1, strokeOpacity: 0.3 }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
              <Bar dataKey="income" fill={INCOME} radius={[4,4,0,0]} name="Income" />
              <Bar dataKey="expenses" fill={EXPENSE} radius={[4,4,0,0]} name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
