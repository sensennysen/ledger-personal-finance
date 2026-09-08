import { useContext } from 'react'
import { GripVertical } from 'lucide-react'
import { WidgetDragContext } from '@/contexts/widgetDragState'
import type { DashboardWidgetKey } from '@/hooks/useDashboardPrefs'

const widgetKeys: Record<string, DashboardWidgetKey> = {
  'Cash Flow': 'cashflowChart',
  'Recent Transactions': 'recentTransactions',
  'Expenses by Category': 'categoryPie',
  'Budget Progress': 'budgets',
  'Upcoming Bills': 'upcomingBills',
  'Cash Flow Forecast': 'cashflowForecast',
  'Credit Card Monitor': 'creditCards',
}
interface DashboardCardHeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}

export function DashboardCardHeader({
  title,
  subtitle,
  action,
  icon,
  className = 'mb-4',
}: DashboardCardHeaderProps) {
  const drag = useContext(WidgetDragContext)
  const key = widgetKeys[title]
  return (
    <div
      onDragOver={(event) => {
        if (drag && key) event.preventDefault()
      }}
      onDrop={(event) => {
        event.preventDefault()
        if (key) drag?.drop(key)
      }}
      className={`flex min-w-0 max-w-full items-start justify-between gap-3 ${className}`}
    >
      {drag && key && (
        <span
          draggable
          onClick={(event) => event.stopPropagation()}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move'
            drag.start(key)
          }}
          onDragEnd={drag.end}
          aria-label={`Drag ${title} to another widget header`}
          title="Drag to reorder widgets"
          className="hidden md:flex cursor-grab text-input pt-0.5"
        >
          <GripVertical className="size-[18px]" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold text-[0.9375rem]">{title}</h2>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className="shrink-0">
        {action ??
          (icon ? (
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-muted border border-border">
              {icon}
            </div>
          ) : null)}
      </div>
    </div>
  )
}
