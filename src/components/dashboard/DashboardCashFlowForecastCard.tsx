import { ArrowRight, BarChart3, TrendingDown, TrendingUp } from 'lucide-react'
import { CORAL, EMERALD } from '@/constants/colors'
import { formatCurrency } from '@/lib/utils'
import type { DashboardCashFlowForecast } from '@/hooks/useDashboardData'
import { DashboardCardHeader } from '@/components/dashboard/DashboardCardHeader'
import { Skeleton } from '@/components/ui/skeleton'

interface DashboardCashFlowForecastCardProps {
  forecast: DashboardCashFlowForecast
  currentBalance: number
  currency: string
  isCurrentMonth: boolean
  monthLabel: string
  loading: boolean
  style?: React.CSSProperties
}

export function DashboardCashFlowForecastCard({
  forecast,
  currentBalance,
  currency,
  isCurrentMonth,
  monthLabel,
  loading,
  style,
}: DashboardCashFlowForecastCardProps) {
  const netChange = forecast.projectedIncome - forecast.projectedExpenses

  return (
    <div className="rounded-xl border border-border/60 p-5 bg-card" style={style}>
      <DashboardCardHeader
        title="Cash Flow Forecast"
        subtitle={isCurrentMonth ? 'Projected end-of-cycle balance' : `Full cycle · ${monthLabel}`}
        icon={<BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />}
      />
      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, index) => <Skeleton key={index} className="h-8" />)}</div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 rounded-lg bg-muted/40 border border-border/40 px-3 py-2.5 text-center">
              <p className="text-[0.625rem] text-muted-foreground uppercase tracking-wider mb-1">Current</p>
              <p className="money text-[0.9375rem] font-bold balance-gradient">{formatCurrency(currentBalance, currency)}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
            <div className="flex-1 rounded-lg bg-muted/40 border border-border/40 px-3 py-2.5 text-center">
              <p className="text-[0.625rem] text-muted-foreground uppercase tracking-wider mb-1">Projected</p>
              <p
                className="money text-[0.9375rem] font-bold"
                style={{ color: forecast.projectedBalance >= currentBalance ? EMERALD : CORAL }}
              >
                {formatCurrency(forecast.projectedBalance, currency)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <TrendingUp className="w-3.5 h-3.5 shrink-0" style={{ color: EMERALD }} />
                Expected income
              </span>
              <span className="money font-medium" style={{ color: EMERALD }}>
                +{formatCurrency(forecast.projectedIncome, currency)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <TrendingDown className="w-3.5 h-3.5 shrink-0" style={{ color: CORAL }} />
                Expected expenses
              </span>
              <span className="money font-medium" style={{ color: CORAL }}>
                -{formatCurrency(forecast.projectedExpenses, currency)}
              </span>
            </div>
            <div className="h-px bg-border/40" />
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Net change</span>
              <span className="money font-semibold" style={{ color: netChange >= 0 ? EMERALD : CORAL }}>
                {netChange >= 0 ? '+' : ''}
                {formatCurrency(netChange, currency)}
              </span>
            </div>
          </div>

          {forecast.forecastItems.length > 0 ? (
            <div className="pt-1 border-t border-border/30 space-y-1">
              <p className="text-[0.625rem] text-muted-foreground uppercase tracking-wider mb-2">Recurring items</p>
              {forecast.forecastItems.slice(0, 4).map((item, index) => (
                <div key={index} className="flex items-center gap-2 py-1 text-xs">
                  <span className="text-[0.8125rem] shrink-0">{item.tx.category?.icon ?? 'Recur'}</span>
                  <span className="flex-1 truncate text-muted-foreground">{item.tx.description}</span>
                  {item.occurrences > 1 && (
                    <span className="text-[0.625rem] text-muted-foreground/50 shrink-0">x{item.occurrences}</span>
                  )}
                  <span
                    className="money font-medium shrink-0"
                    style={{ color: item.tx.type === 'income' ? EMERALD : CORAL }}
                  >
                    {item.tx.type === 'income' ? '+' : '-'}
                    {formatCurrency(item.total, currency)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center pt-2">No recurring transactions found</p>
          )}
        </div>
      )}
    </div>
  )
}
