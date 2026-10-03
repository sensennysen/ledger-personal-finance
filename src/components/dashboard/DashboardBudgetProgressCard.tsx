import { Link } from 'react-router-dom'
import { BUDGET_TONE_BAR_CLASS, budgetTone } from '@/lib/budgetUsage'
import { EXPENSE, WARNING_INK } from '@/constants/colors'
import { formatCurrency } from '@/lib/utils'
import type { Budget } from '@/types'
import { DashboardCardHeader } from '@/components/dashboard/DashboardCardHeader'
import { Progress } from '@/components/ui/progress'

interface DashboardBudgetProgressCardProps {
  budgets: Budget[]
  monthLabel: string
  style?: React.CSSProperties
}

const DESKTOP_LIMIT = 4
// A phone shows two budgets, as design 18a does, so Home's first four widgets fit above the
// bottom nav at 390x844 (LED-202); the link leads to the rest.
const PHONE_LIMIT = 2

function getBudgetAmountColor(over: boolean, percentage: number) {
  const tone = budgetTone(percentage, over)
  if (tone === 'expense') return EXPENSE
  if (tone === 'gold') return WARNING_INK
  return 'var(--muted-foreground)'
}

export function DashboardBudgetProgressCard({
  budgets,
  monthLabel,
  style,
}: DashboardBudgetProgressCardProps) {
  return (
    <div className="rounded-[20px] border border-border p-4 md:p-5 bg-card" style={style}>
      <DashboardCardHeader
        className="mb-2.5 md:mb-4"
        title="Budget Progress"
        subtitle={`Spending vs budget limits · ${monthLabel}`}
        subtitleOnPhone={false}
        action={
          budgets.length > PHONE_LIMIT ? (
            <Link to="/budgets" className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline md:hidden">
              See all {budgets.length}
            </Link>
          ) : undefined
        }
      />
      <div className="space-y-3 md:space-y-4">
        {budgets.slice(0, DESKTOP_LIMIT).map((budget, index) => {
          const spent = budget.spent ?? 0
          const percentage = Math.min((spent / budget.amount) * 100, 100)
          const over = spent > budget.amount

          return (
            <div key={budget.id} className={`space-y-1.5 ${index >= PHONE_LIMIT ? 'max-md:hidden' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[0.8125rem]">
                  <span>{budget.category?.icon}</span>
                  <span className="text-foreground/80">{budget.name}</span>
                </span>
                <span className="money text-xs" style={{ color: getBudgetAmountColor(over, percentage) }}>
                  {formatCurrency(spent, budget.currency)} / {formatCurrency(budget.amount, budget.currency)}
                </span>
              </div>
              <Progress value={percentage} className={BUDGET_TONE_BAR_CLASS[budgetTone(percentage, over)]} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
