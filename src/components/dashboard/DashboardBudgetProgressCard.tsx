import { BUDGET_WARNING_THRESHOLD } from '@/constants/accounts'
import { CORAL } from '@/constants/colors'
import { formatCurrency } from '@/lib/utils'
import type { Budget } from '@/types'
import { DashboardCardHeader } from '@/components/dashboard/DashboardCardHeader'
import { Progress } from '@/components/ui/progress'

interface DashboardBudgetProgressCardProps {
  budgets: Budget[]
  monthLabel: string
  style?: React.CSSProperties
}

function getBudgetAmountColor(over: boolean, percentage: number) {
  if (over) return CORAL
  if (percentage > BUDGET_WARNING_THRESHOLD) return 'oklch(0.750 0.140 75)'
  return 'oklch(0.570 0.015 290)'
}

function getBudgetProgressClass(over: boolean, percentage: number) {
  if (over) return '[&>div]:bg-[oklch(0.620_0.160_18)]'
  if (percentage > BUDGET_WARNING_THRESHOLD) return '[&>div]:bg-[oklch(0.750_0.140_75)]'
  return '[&>div]:bg-primary'
}

export function DashboardBudgetProgressCard({
  budgets,
  monthLabel,
  style,
}: DashboardBudgetProgressCardProps) {
  return (
    <div className="rounded-xl border border-border/60 p-5 bg-card" style={style}>
      <DashboardCardHeader
        title="Budget Progress"
        subtitle={`Spending vs budget limits · ${monthLabel}`}
      />
      <div className="space-y-4">
        {budgets.slice(0, 4).map((budget) => {
          const spent = budget.spent ?? 0
          const percentage = Math.min((spent / budget.amount) * 100, 100)
          const over = spent > budget.amount

          return (
            <div key={budget.id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[0.8125rem]">
                  <span>{budget.category?.icon}</span>
                  <span className="text-foreground/80">{budget.name}</span>
                </span>
                <span className="money text-xs" style={{ color: getBudgetAmountColor(over, percentage) }}>
                  {formatCurrency(spent, budget.currency)} / {formatCurrency(budget.amount, budget.currency)}
                </span>
              </div>
              <Progress value={percentage} className={getBudgetProgressClass(over, percentage)} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
