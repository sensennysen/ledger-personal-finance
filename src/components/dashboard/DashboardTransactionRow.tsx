interface DashboardTransactionRowProps {
  icon: React.ReactNode
  iconBackgroundColor: string
  title: string
  subtitle: React.ReactNode
  amount: React.ReactNode
  rightDetail?: React.ReactNode
  className?: string
}

export function DashboardTransactionRow({
  icon,
  iconBackgroundColor,
  title,
  subtitle,
  amount,
  rightDetail,
  className = 'hover:bg-white/3',
}: DashboardTransactionRowProps) {
  return (
    <div className={`grid w-full min-w-0 max-w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2.5 transition-colors ${className}`}>
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
        style={{ backgroundColor: iconBackgroundColor }}
      >
        {icon}
      </div>
      <div className="min-w-0 overflow-hidden">
        <p className="text-[0.8125rem] font-medium truncate text-foreground/90">{title}</p>
        <div className="truncate text-[0.6875rem] text-muted-foreground">{subtitle}</div>
      </div>
      <div className="min-w-0 text-right">
        <div className="money whitespace-nowrap text-[0.8125rem] font-semibold">{amount}</div>
        {rightDetail}
      </div>
    </div>
  )
}
