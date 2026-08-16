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
  return (
    <div className={`flex min-w-0 max-w-full items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold text-[0.9375rem]">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className="shrink-0">{action ?? (icon ? (
        <div className="w-7 h-7 rounded-md flex items-center justify-center bg-muted border border-border">
          {icon}
        </div>
      ) : null)}</div>
    </div>
  )
}
