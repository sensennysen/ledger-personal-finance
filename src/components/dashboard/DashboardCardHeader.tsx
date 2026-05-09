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
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <div>
        <p className="font-semibold text-[0.9375rem]">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {action ?? (icon ? (
        <div className="w-7 h-7 rounded-md flex items-center justify-center bg-muted border border-border">
          {icon}
        </div>
      ) : null)}
    </div>
  )
}
