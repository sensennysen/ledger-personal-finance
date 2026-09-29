import { AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { AttentionItem } from '@/lib/budgetSummary'

// Over-budget and near-limit budgets, worst first (design 4b "Needs attention").
// The tint is --warning-container with foreground ink, a pair themeContrast holds.
export function NeedsAttention({
  items,
  daysLeft,
}: {
  items: AttentionItem[]
  daysLeft: number | null
}) {
  if (items.length === 0) return null
  const tail = daysLeft === null ? '' : ` with ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left in the cycle`
  return (
    <section
      aria-labelledby="needs-attention-heading"
      className="rounded-xl border border-gold bg-warning-container p-4 text-foreground"
    >
      <h2 id="needs-attention-heading" className="flex items-center gap-1.5 text-sm font-semibold">
        <AlertTriangle className="size-4" aria-hidden />
        Needs attention
      </h2>
      <ul className="mt-2 space-y-1 text-sm">
        {items.map((item) => (
          <li key={item.id}>
            {item.kind === 'over' ? (
              <>
                <strong>{item.name}</strong> is <strong className="tabular-nums">{formatCurrency(item.overBy, item.currency)} over</strong>
                {tail}.
              </>
            ) : (
              <>
                <strong>{item.name}</strong> is at <strong className="tabular-nums">{item.usedPct}%</strong> of its limit
                {tail}.
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
