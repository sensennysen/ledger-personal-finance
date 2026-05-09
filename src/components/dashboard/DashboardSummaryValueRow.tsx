interface DashboardSummaryValueRowProps {
  label: string
  value: React.ReactNode
}

export function DashboardSummaryValueRow({
  label,
  value,
}: DashboardSummaryValueRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
      {value}
    </div>
  )
}
