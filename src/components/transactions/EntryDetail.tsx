import { useState } from 'react'
import { Pencil, Scissors, Trash2 } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useBudgets } from '@/hooks/useBudgets'
import { useCycle } from '@/contexts/cycleState'
import { monthKeyOf } from '@/lib/monthJump'
import { getBudgetCycleRange } from '@/lib/budgetCycle'
import { entryBudgetImpact } from '@/lib/budgetImpact'
import { isPendingReceiptReference, resolveReceiptUrl } from '@/lib/receiptUrls'
import type { Transaction } from '@/types'

export function EntryDetail({
  transaction,
  onEdit,
  onDelete,
  onSplit,
}: {
  transaction: Transaction
  onEdit?: () => void
  onDelete?: () => void
  onSplit?: () => void
}) {
  const accountName = transaction.account?.name ?? 'Account'
  const tags = transaction.tags ?? []
  const rows: [string, React.ReactNode][] = [
    ['Date', formatDate(transaction.date)],
    ['Category', transaction.category?.name ?? 'Uncategorized'],
    transaction.to_account
      ? ['From → To', `${accountName} → ${transaction.to_account.name}`]
      : ['Account', accountName],
    ...(tags.length > 0
      ? [[
          'Tags',
          <span className="inline-flex flex-wrap justify-end gap-1">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                #{tag}
              </span>
            ))}
          </span>,
        ] as [string, React.ReactNode]]
      : []),
    ['Note', transaction.notes ?? '—'],
  ]

  return (
    <div className="space-y-5">
      <div className="text-center rounded-[20px] bg-card p-5">
        <p className="text-lg font-medium">{transaction.description}</p>
        <p
          className="money text-3xl mt-3 break-words"
          style={{ color: `var(--${transaction.type})` }}
        >
          {transaction.type === 'income'
            ? '+'
            : transaction.type === 'expense'
              ? '−'
              : ''}
          {formatCurrency(transaction.amount, transaction.currency)}
        </p>
      </div>
      <dl className="divide-y divide-border">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-4 justify-between py-3 text-sm">
            <dt className="text-muted-foreground shrink-0">{label}</dt>
            <dd className="text-right break-words min-w-0">{value}</dd>
          </div>
        ))}
        {transaction.receipt_url && (
          <div className="flex gap-4 justify-between py-3 text-sm">
            <dt className="text-muted-foreground shrink-0">Receipt</dt>
            <dd className="text-right min-w-0">
              <ReceiptLink value={transaction.receipt_url} />
            </dd>
          </div>
        )}
      </dl>
      {transaction.type === 'expense' && transaction.category_id && (
        <BudgetImpactBar transaction={transaction} />
      )}
      {(onEdit || onSplit || onDelete) && (
        <div className="space-y-2">
          {onEdit && (
            <Button className="w-full" onClick={onEdit}>
              <Pencil />
              Edit entry
            </Button>
          )}
          {(onSplit || onDelete) && (
            <div className="grid grid-cols-2 gap-2">
              {onSplit && (
                <Button variant="outline" onClick={onSplit}>
                  <Scissors />
                  Split
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="outline"
                  className={onSplit ? 'text-expense' : 'col-span-2 text-expense'}
                  onClick={onDelete}
                >
                  <Trash2 />
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ReceiptLink({ value }: { value: string }) {
  const [state, setState] = useState<'idle' | 'opening' | 'failed'>('idle')
  if (isPendingReceiptReference(value)) {
    return <span className="text-muted-foreground">Uploads when you're back online</span>
  }
  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        className="text-primary underline-offset-2 hover:underline disabled:opacity-60"
        disabled={state === 'opening'}
        onClick={async () => {
          setState('opening')
          const url = await resolveReceiptUrl(value)
          if (url) {
            window.open(url, '_blank', 'noopener,noreferrer')
            setState('idle')
          } else {
            setState('failed')
          }
        }}
      >
        {state === 'opening' ? 'Opening…' : 'View receipt'}
      </button>
      {state === 'failed' && (
        <span role="alert" className="text-xs text-expense">
          Couldn't open the receipt. Try again.
        </span>
      )}
    </span>
  )
}

/** This entry's share of its category bar for the cycle it falls in. */
function BudgetImpactBar({ transaction }: { transaction: Transaction }) {
  const { startDay } = useCycle()
  const month = monthKeyOf(transaction.date, startDay)
  const { budgets } = useBudgets({ selectedMonth: month, startDay })
  const budget = budgets.find((b) => b.category_id === transaction.category_id)
  const impact = budget
    ? entryBudgetImpact(transaction, budget, getBudgetCycleRange(budget.period, month, startDay))
    : null
  if (!budget || !impact) return null

  const pct = (n: number) => `${Math.min(100, (n / impact.allowance) * 100)}%`
  const before = Math.max(0, impact.spent - impact.entry)
  const over = impact.spent > impact.allowance
  return (
    <div className="space-y-2 rounded-[16px] bg-card p-4 text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium">Budget impact</p>
        <p className="text-xs text-muted-foreground truncate">{budget.name}</p>
      </div>
      <div
        className="relative h-2 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`This entry is ${formatCurrency(impact.entry, impact.currency)} of ${formatCurrency(impact.spent, impact.currency)} spent against a ${formatCurrency(impact.allowance, impact.currency)} budget`}
      >
        <div
          className="absolute inset-y-0 left-0 bg-muted-foreground/40"
          style={{ width: pct(before) }}
        />
        <div
          className={over ? 'absolute inset-y-0 bg-expense' : 'absolute inset-y-0 bg-primary'}
          style={{ left: pct(before), width: `calc(${pct(impact.spent)} - ${pct(before)})` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {formatCurrency(impact.entry, impact.currency)} of{' '}
        {formatCurrency(impact.spent, impact.currency)} spent ·{' '}
        {formatCurrency(impact.allowance, impact.currency)} budget
        {over && <span className="text-expense"> · over</span>}
      </p>
    </div>
  )
}
