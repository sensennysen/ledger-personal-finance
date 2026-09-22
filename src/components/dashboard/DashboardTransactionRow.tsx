import { InteractiveRow } from '@/components/ui/interactive-row'

interface DashboardTransactionRowProps {
  onClick?: () => void
  icon: React.ReactNode
  iconBackgroundColor: string
  title: string
  subtitle: React.ReactNode
  amount: React.ReactNode
  rightDetail?: React.ReactNode
  className?: string
}

export function DashboardTransactionRow({
  onClick,
  icon,
  iconBackgroundColor,
  title,
  subtitle,
  amount,
  rightDetail,
  className = 'hover:bg-white/3',
}: DashboardTransactionRowProps) {
  const rowClassName = `grid w-full min-w-0 max-w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2.5 transition-colors ${className}`
  const content = (
    <>
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-sm shrink-0"
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
    </>
  )

  if (!onClick) {
    return <div className={rowClassName}>{content}</div>
  }

  return (
    <InteractiveRow as="button" onActivate={onClick} className={rowClassName}>
      {content}
    </InteractiveRow>
  )
}
