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
    <div className={`flex items-center gap-3 py-2.5 px-2 rounded-lg transition-colors ${className}`}>
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
        style={{ backgroundColor: iconBackgroundColor }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[0.8125rem] font-medium truncate text-foreground/90">{title}</p>
        <div className="text-[0.6875rem] text-muted-foreground">{subtitle}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="money text-[0.8125rem] font-semibold">{amount}</div>
        {rightDetail}
      </div>
    </div>
  )
}
