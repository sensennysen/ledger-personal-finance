import { useMemo } from 'react'
import { buildCategoryBreakdown, topCategories } from '@/lib/categoryBreakdown'
import { useCategoryInk } from '@/hooks/useCategoryInk'
import { formatCurrency } from '@/lib/utils'
import { UnratedCurrencyNotice } from '@/components/UnratedCurrencyNotice'
import type { RateTable } from '@/lib/exchangeRates'
import type { Transaction } from '@/types'

/** Rail block "Top categories, this filter" (29a): one combined list, converted into `baseCurrency` (LED-183). */
export function FilterTopCategories({
  transactions,
  baseCurrency,
  rateTable = null,
}: {
  transactions: Transaction[]
  baseCurrency: string
  rateTable?: RateTable | null
}) {
  const ink = useCategoryInk()
  const summary = useMemo(() => {
    const expenses = transactions.filter((t) => t.type === 'expense')
    if (expenses.length === 0) return null
    const categoryById = new Map<string, { name: string; color: string }>()
    for (const t of expenses) if (t.category_id && t.category) categoryById.set(t.category_id, t.category)
    const { rows, excludedCurrencies } = buildCategoryBreakdown(expenses, categoryById, baseCurrency, rateTable)
    return { excludedCurrencies, ...topCategories(rows) }
  }, [transactions, baseCurrency, rateTable])

  if (!summary || summary.top.length === 0) return null
  const { top, other, excludedCurrencies } = summary
  return (
    <section aria-label="Top categories, this filter" className="mt-4 flex flex-col gap-1.5">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Top categories, this filter</p>
      {top.map((slice) => (
        <div key={slice.key} className="flex items-center justify-between gap-2 text-xs">
          <span className="flex min-w-0 items-center gap-2">
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: ink(slice.color) }} />
            <span className="truncate">{slice.name}</span>
          </span>
          <span className="money shrink-0">{formatCurrency(slice.amount, baseCurrency)}</span>
        </div>
      ))}
      {other && (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Other, {other.count} categories</span>
          <span className="money">{formatCurrency(other.amount, baseCurrency)}</span>
        </div>
      )}
      <UnratedCurrencyNotice currencies={excludedCurrencies} />
    </section>
  )
}
