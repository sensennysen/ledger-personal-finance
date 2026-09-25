import { useMemo } from 'react'
import { buildCategoryBreakdown, topCategories } from '@/lib/categoryBreakdown'
import { useCategoryInk } from '@/hooks/useCategoryInk'
import { formatCurrency } from '@/lib/utils'
import type { Transaction } from '@/types'

/**
 * Rail block "Top categories, this filter" (29a). The list has no conversion, so it
 * counts one currency (the one with the most expenses) and says when others exist.
 */
export function FilterTopCategories({ transactions }: { transactions: Transaction[] }) {
  const ink = useCategoryInk()
  const summary = useMemo(() => {
    const expenses = transactions.filter((t) => t.type === 'expense')
    const perCurrency = new Map<string, Transaction[]>()
    for (const t of expenses) perCurrency.set(t.currency, [...(perCurrency.get(t.currency) ?? []), t])
    const [currency, rows] = [...perCurrency.entries()].sort((a, b) => b[1].length - a[1].length)[0] ?? []
    if (!currency || !rows) return null
    const categoryById = new Map<string, { name: string; color: string }>()
    for (const t of rows) if (t.category_id && t.category) categoryById.set(t.category_id, t.category)
    const slices = buildCategoryBreakdown(rows.map((t) => ({ ...t, exchange_rate: 1 })), categoryById)
    return { currency, otherCurrencies: perCurrency.size - 1, ...topCategories(slices) }
  }, [transactions])

  if (!summary || summary.top.length === 0) return null
  const { currency, top, other, otherCurrencies } = summary
  return (
    <section aria-label="Top categories, this filter" className="mt-4 flex flex-col gap-1.5">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Top categories, this filter</p>
      {top.map((slice) => (
        <div key={slice.key} className="flex items-center justify-between gap-2 text-xs">
          <span className="flex min-w-0 items-center gap-2">
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: ink(slice.color) }} />
            <span className="truncate">{slice.name}</span>
          </span>
          <span className="money shrink-0">{formatCurrency(slice.amount, currency)}</span>
        </div>
      ))}
      {other && (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Other, {other.count} categories</span>
          <span className="money">{formatCurrency(other.amount, currency)}</span>
        </div>
      )}
      {otherCurrencies > 0 && <p className="text-[0.6875rem] text-muted-foreground">{currency} only; other currencies are not added in.</p>}
    </section>
  )
}
