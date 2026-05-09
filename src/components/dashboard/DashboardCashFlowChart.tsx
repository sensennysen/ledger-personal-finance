import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CORAL, EMERALD } from '@/constants/colors'
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
  style?: React.CSSProperties
}

export function DashboardCashFlowChart({
  chartPeriod,
  setChartPeriod,
  cashFlowData,
  currency,
  currencySymbol,
  loading,
  style,
}: DashboardCashFlowChartProps) {
  return (
    <div className="rounded-xl border border-border/60 overflow-hidden bg-card lg:col-span-2" style={style}>
      <div className="px-5 pt-5 pb-3">
        <DashboardCardHeader
          title="Cash Flow"
          subtitle="Income vs expenses over time"
          action={(
            <Tabs value={chartPeriod} onValueChange={(value) => setChartPeriod(value as DashboardChartPeriod)}>
              <TabsList className="h-8 w-full sm:w-auto">
                <TabsTrigger value="week" className="text-xs flex-1 sm:flex-none px-3">This Week</TabsTrigger>
                <TabsTrigger value="month" className="text-xs flex-1 sm:flex-none px-3">This Month</TabsTrigger>
                <TabsTrigger value="quarterly" className="text-xs flex-1 sm:flex-none px-3">Quarterly</TabsTrigger>
                <TabsTrigger value="yearly" className="text-xs flex-1 sm:flex-none px-3">Yearly</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          className="flex-col sm:flex-row sm:items-center mb-0"
        />
      </div>
      <div className="px-2 pb-4">
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={cashFlowData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="income-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={EMERALD} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={EMERALD} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expense-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CORAL} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={CORAL} stopOpacity={0} />
                </linearGradient>
              </defs>
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
              <Area type="monotone" dataKey="income" stroke={EMERALD} fill="url(#income-grad)" strokeWidth={2} name="Income" dot={false} />
              <Area type="monotone" dataKey="expenses" stroke={CORAL} fill="url(#expense-grad)" strokeWidth={2} name="Expenses" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
